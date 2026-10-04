import { analyze } from "../../analyze";
import { parseEnvironment, ValidationError, type Environment } from "../parser";
import type { Severity } from "../security-rules";

export type Change =
  | { type: "make_private"; resourceId: string }
  | {
      type: "remove_permission";
      resourceId: string;
      target: string;
      action?: "read" | "write" | "admin";
    }
  | {
      type: "remove_relationship";
      resourceId: string;
      relType: string;
      target: string;
    };
type Analysis = ReturnType<typeof analyze>;
interface PathRef {
  id: string;
  nodes: string[];
  severity: Severity;
  score: number;
}

const nameOf = (env: Environment, id: string) =>
  env.resources.find((r) => r.id === id)?.name ?? id;
export const describe = (env: Environment, c: Change) =>
  c.type === "make_private"
    ? `Make ${nameOf(env, c.resourceId)} private`
    : c.type === "remove_permission"
      ? `Remove ${c.action ?? "all"} access from ${nameOf(env, c.resourceId)} to ${nameOf(env, c.target)}`
      : `Remove the ${c.relType.replace("_", " ")} link from ${nameOf(env, c.resourceId)} to ${nameOf(env, c.target)}`;

/** Applies a simulated change to a deep copy of the environment. The original is never modified. */
export function applyChange(env: Environment, c: Change): Environment {
  const copy: Environment = JSON.parse(JSON.stringify(env));
  const r = copy.resources.find((x) => x.id === c.resourceId);
  let changed = false;
  if (r && c.type === "make_private") {
    changed = r.public;
    r.public = false;
  } else if (r && c.type === "remove_permission") {
    const n = r.permissions.length;
    r.permissions = r.permissions.filter(
      (p) => !(p.target === c.target && (!c.action || p.action === c.action)),
    );
    changed = r.permissions.length < n;
  } else if (r && c.type === "remove_relationship") {
    const n = r.relationships.length;
    r.relationships = r.relationships.filter(
      (x) => !(x.target === c.target && x.type === c.relType),
    );
    changed = r.relationships.length < n;
  }
  if (!changed)
    throw new ValidationError([
      "This change does not match anything in the environment",
    ]);
  return copy;
}

const ref = (p: Analysis["paths"][number]): PathRef => ({
  id: p.id,
  nodes: p.nodes,
  severity: p.risk.severity,
  score: p.risk.score,
});
const snap = (a: Analysis) => ({
  paths: a.paths.length,
  critical: a.paths.filter((p) => p.risk.severity === "critical").length,
  findings: a.findings.length,
});

/** Baseline vs simulation, matching paths by their ordered node sequence (IDs can shift between runs). */
export function compare(base: Analysis, sim: Analysis) {
  const key = (p: { nodes: string[] }) => p.nodes.join(">");
  const bm = new Map(base.paths.map((p) => [key(p), p])),
    sm = new Map(sim.paths.map((p) => [key(p), p]));
  const targets = (a: Analysis) => new Set(a.paths.map((p) => p.target));
  const tb = targets(base),
    ta = targets(sim);
  return {
    before: snap(base),
    after: snap(sim),
    removed: base.paths.filter((p) => !sm.has(key(p))).map(ref),
    added: sim.paths.filter((p) => !bm.has(key(p))).map(ref),
    changed: sim.paths
      .filter(
        (p) => bm.has(key(p)) && bm.get(key(p))!.risk.score !== p.risk.score,
      )
      .map((p) => ({
        id: p.id,
        nodes: p.nodes,
        from: bm.get(key(p))!.risk.score,
        to: p.risk.score,
      })),
    targetsProtected: [...tb].filter((t) => !ta.has(t)).sort(),
    targetsStillReachable: [...ta].sort(),
  };
}

export function simulate(envRaw: unknown, change: Change) {
  const env = parseEnvironment(envRaw);
  return {
    change,
    label: describe(env, change),
    ...compare(analyze(env), analyze(applyChange(env, change))),
  };
}

/** Path-breaking impact: tries every single change and ranks them by how many attack paths it removes. */
export function rankRemediations(envRaw: unknown, limit = 8) {
  const env = parseEnvironment(envRaw),
    base = analyze(env);
  const candidates: Change[] = [];
  for (const r of env.resources) {
    if (r.public) candidates.push({ type: "make_private", resourceId: r.id });
    for (const p of r.permissions)
      candidates.push({
        type: "remove_permission",
        resourceId: r.id,
        target: p.target,
        action: p.action,
      });
    for (const x of r.relationships)
      candidates.push({
        type: "remove_relationship",
        resourceId: r.id,
        relType: x.type,
        target: x.target,
      });
  }
  return candidates
    .map((change) => {
      const c = compare(base, analyze(applyChange(env, change)));
      return {
        change,
        label: describe(env, change),
        pathsRemoved: c.removed.length,
        criticalPathsRemoved: c.removed.filter((p) => p.severity === "critical")
          .length,
        riskReduction: c.removed.reduce((s, p) => s + p.score, 0),
      };
    })
    .filter((x) => x.pathsRemoved > 0)
    .sort(
      (a, b) =>
        b.criticalPathsRemoved - a.criticalPathsRemoved ||
        b.pathsRemoved - a.pathsRemoved ||
        b.riskReduction - a.riskReduction ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}
