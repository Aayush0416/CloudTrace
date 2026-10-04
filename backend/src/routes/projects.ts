import rateLimit from "express-rate-limit";
import { simulate, rankRemediations, type Change } from "../services/whatif";
import { getProvider } from "../services/ai";
import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { HttpError, requireAuth, userId } from "../middleware";
import { analyze } from "../analyze";
import { parseEnvironment } from "../services/parser";

const r = Router();
r.use(requireAuth);
const aiLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  keyGenerator: (req) => userId(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many assistant requests. Try again in a few minutes.",
  },
});
const aiCache = new Map<string, unknown>();

const owned = async (req: Request) => {
  const id = String(req.params.id);
  const p = await prisma.project.findFirst({
    where: { id, ownerId: userId(req) },
  });
  if (!p) throw new HttpError(404, "Project not found");
  return p;
};
const summarize = (result: any) =>
  result
    ? {
        resources: result.resources.length,
        findings: result.findings.length,
        paths: result.paths.length,
        criticalPaths: result.paths.filter(
          (p: any) => p.risk.severity === "critical",
        ).length,
      }
    : null;
const latestResult = async (projectId: string) =>
  await prisma.scan.findFirst({
    where: { projectId, status: "completed" },
    orderBy: { startedAt: "desc" },
  });

const body = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

r.get("/", async (req, res) => {
  const list = await prisma.project.findMany({
    where: { ownerId: userId(req) },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    await Promise.all(
      list.map(async (p) => {
        const s = await latestResult(p.id);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          provider: p.provider,
          createdAt: p.createdAt,
          environmentName: (p.environment as any)?.name ?? null,
          lastScanAt: s?.completedAt ?? null,
          summary: summarize(s?.result),
        };
      }),
    ),
  );
});
r.post("/", async (req, res) => {
  const b = body.parse(req.body);
  res
    .status(201)
    .json(
      await prisma.project.create({ data: { ...b, ownerId: userId(req) } }),
    );
});
r.get("/:id", async (req, res) => {
  const p = await owned(req);
  const s = await latestResult(p.id);
  res.json({
    id: p.id,
    name: p.name,
    description: p.description,
    provider: p.provider,
    environmentName: (p.environment as any)?.name ?? null,
    hasEnvironment: !!p.environment,
    lastScanAt: s?.completedAt ?? null,
    summary: summarize(s?.result),
  });
});
r.patch("/:id", async (req, res) => {
  await owned(req);
  res.json(
    await prisma.project.update({
      where: { id: String(req.params.id) },
      data: body.partial().parse(req.body),
    }),
  );
});
r.delete("/:id", async (req, res) => {
  await owned(req);
  await prisma.project.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

// FR-03/04/05: validate and store the environment
r.post("/:id/import", async (req, res) => {
  const p = await owned(req);
  const env = parseEnvironment(req.body);
  await prisma.project.update({
    where: { id: p.id },
    data: { environment: env as any },
  });
  res.json({ name: env.name, resources: env.resources.length });
});

// FR-06..10, FR-14: run the deterministic pipeline and record the scan
r.post("/:id/scan", async (req, res) => {
  const p = await owned(req);
  if (!p.environment)
    throw new HttpError(409, "Import an environment before running a scan");
  const startedAt = new Date();
  const out = analyze(p.environment);
  const env = parseEnvironment(p.environment);
  const gn = new Map(out.graph.nodes.map((n) => [n.id, n]));
  const resources = env.resources.map((x) => ({
    subnet: gn.get(x.id)?.subnet,
    vpc: gn.get(x.id)?.vpc,
    id: x.id,
    name: x.name,
    type: x.type,
    subtype: x.subtype,
    public: x.public,
    criticality: x.criticality,
    findingCount: out.findings.filter((f) => f.resourceId === x.id).length,
    pathCount: out.paths.filter((a) => a.nodes.includes(x.id)).length,
  }));
  const scan = await prisma.scan.create({
    data: {
      projectId: p.id,
      startedAt,
      completedAt: new Date(),
      result: { ...out, resources } as any,
    },
  });
  res
    .status(201)
    .json({
      id: scan.id,
      completedAt: scan.completedAt,
      summary: summarize({ ...out, resources }),
    });
});
r.get("/:id/scans", async (req, res) => {
  const p = await owned(req);
  const scans = await prisma.scan.findMany({
    where: { projectId: p.id },
    orderBy: { startedAt: "asc" },
  });
  res.json(
    scans.map((s) => ({
      id: s.id,
      status: s.status,
      source: s.source,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      summary: summarize(s.result),
    })),
  );
});

// Read endpoints backed by the latest completed scan
for (const [route, key, empty] of [
  ["resources", "resources", []],
  ["findings", "findings", []],
  ["attack-paths", "paths", []],
  ["graph", "graph", { nodes: [], edges: [] }],
  ["choke-points", "chokePoints", []],
] as const)
  r.get(`/:id/${route}`, async (req, res) => {
    const p = await owned(req);
    const s = await latestResult(p.id);
    res.json({
      scanId: s?.id ?? null,
      completedAt: s?.completedAt ?? null,
      data: (s?.result as any)?.[key] ?? empty,
      truncated: !!(s?.result as any)?.truncated,
    });
  });

// FR-13: what-if simulation on a copy of the environment
const changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("make_private"), resourceId: z.string() }),
  z.object({
    type: z.literal("remove_permission"),
    resourceId: z.string(),
    target: z.string(),
    action: z.enum(["read", "write", "admin"]).optional(),
  }),
  z.object({
    type: z.literal("remove_relationship"),
    resourceId: z.string(),
    relType: z.string(),
    target: z.string(),
  }),
]);
r.post("/:id/what-if", async (req, res) => {
  const p = await owned(req);
  if (!p.environment)
    throw new HttpError(409, "Import an environment before simulating changes");
  res.json(
    simulate(p.environment, changeSchema.parse(req.body?.change) as Change),
  );
});
r.get("/:id/remediations", async (req, res) => {
  const p = await owned(req);
  res.json(p.environment ? rankRemediations(p.environment) : []);
});

// AI layer: downstream of the stored scan result only
const aiContext = async (req: Request) => {
  const project = await owned(req);
  const s = await latestResult(project.id);
  if (!s?.result)
    throw new HttpError(409, "Run a scan before using the assistant");
  const result = s.result as any;
  return {
    project,
    result,
    scanId: s.id,
    labels: Object.fromEntries(
      result.graph.nodes.map((n: any) => [n.id, n.label]),
    ) as Record<string, string>,
  };
};
for (const kind of ["explain", "remediation"] as const)
  r.post(`/:id/attack-paths/:pathId/${kind}`, aiLimiter, async (req, res) => {
    const { result, labels, scanId } = await aiContext(req);
    const path = result.paths.find((x: any) => x.id === req.params.pathId);
    if (!path)
      throw new HttpError(404, "Attack path not found in the latest scan");
    const ai = getProvider();
    const ck = `${scanId}|${path.id}|${kind}`,
      hit = aiCache.get(ck);
    if (hit) {
      res.json(hit);
      return;
    }
    const out =
      kind === "explain"
        ? await ai.explainPath({ path, labels })
        : await ai.suggestFixes({ path, labels });
    if (out.mode === "llm") aiCache.set(ck, out);
    res.json(out);
  });
r.post("/:id/assistant", aiLimiter, async (req, res) => {
  const { question } = z
    .object({ question: z.string().trim().min(1).max(500) })
    .parse(req.body);
  const { project, result, labels } = await aiContext(req);
  const ranked = project.environment
    ? rankRemediations(project.environment)
    : [];
  res.json(
    await getProvider().chat(question, {
      labels,
      paths: result.paths,
      findings: result.findings,
      resources: result.resources,
      ranked,
    }),
  );
});
// Finding workflow: status survives re-scans because it is keyed by project + rule + resource
const stateSchema = z
  .object({
    ruleId: z.string(),
    resourceId: z.string(),
    status: z.enum(["open", "acknowledged", "fixed", "accepted"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status !== "accepted" || (v.note?.length ?? 0) >= 5, {
    message: "Risk acceptance needs a justification (5+ characters)",
    path: ["note"],
  });
r.get("/:id/finding-states", async (req, res) => {
  const p = await owned(req);
  res.json(await prisma.findingState.findMany({ where: { projectId: p.id } }));
});
r.put("/:id/finding-states", async (req, res) => {
  const p = await owned(req),
    b = stateSchema.parse(req.body);
  res.json(
    await prisma.findingState.upsert({
      where: {
        projectId_ruleId_resourceId: {
          projectId: p.id,
          ruleId: b.ruleId,
          resourceId: b.resourceId,
        },
      },
      create: {
        projectId: p.id,
        ruleId: b.ruleId,
        resourceId: b.resourceId,
        status: b.status,
        note: b.note ?? null,
      },
      update: { status: b.status, note: b.note ?? null },
    }),
  );
});

// Scan-to-scan diff: paths matched by their ordered node sequence
r.get("/:id/diff", async (req, res) => {
  const p = await owned(req);
  const scans = await prisma.scan.findMany({
    where: { projectId: p.id, status: "completed" },
    orderBy: { startedAt: "desc" },
    take: 2,
  });
  if (scans.length < 2) {
    res.json(null);
    return;
  }
  const cur: any[] = (scans[0].result as any).paths,
    prev: any[] = (scans[1].result as any).paths;
  const k = (x: any) => x.nodes.join(">"),
    pm = new Map(prev.map((x) => [k(x), x])),
    cm = new Map(cur.map((x) => [k(x), x]));
  const ref = (x: any) => ({
    id: x.id,
    nodes: x.nodes,
    severity: x.risk.severity,
    score: x.risk.score,
  });
  res.json({
    previousAt: scans[1].completedAt,
    currentAt: scans[0].completedAt,
    newPaths: cur.filter((x) => !pm.has(k(x))).map(ref),
    resolvedPaths: prev.filter((x) => !cm.has(k(x))).map(ref),
    scoreChanges: cur
      .filter((x) => pm.has(k(x)) && pm.get(k(x)).risk.score !== x.risk.score)
      .map((x) => ({
        id: x.id,
        nodes: x.nodes,
        from: pm.get(k(x)).risk.score,
        to: x.risk.score,
      })),
  });
});
export default r;
