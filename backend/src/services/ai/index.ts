import { z } from "zod";
import { ADVICE, type Finding } from "../security-rules";

/** The AI layer is downstream of the deterministic engine: it only explains data it is given. */
export interface PathCtx {
  path: any;
  labels: Record<string, string>;
}
export interface ChatCtx {
  labels: Record<string, string>;
  paths: any[];
  findings: Finding[];
  resources: any[];
  ranked: Ranked[] | (() => Ranked[]);
}
export interface Ranked {
  label: string;
  pathsRemoved: number;
  criticalPathsRemoved: number;
}
const rankedOf = (c: ChatCtx): Ranked[] =>
  typeof c.ranked === "function" ? c.ranked() : c.ranked;
export interface AiResult {
  summary: string;
  step_explanations: { step: number; explanation: string }[];
  contributing_findings: string[];
  remediation_steps: string[];
  assumptions: string[];
  uncertainty: string[];
  mode: "demo" | "llm";
}
export interface ChatReply {
  answer: string;
  references: { type: "path" | "resource"; id: string }[];
  suggestions: string[];
  mode: "demo" | "llm";
}
export interface AiProvider {
  name: string;
  explainPath(c: PathCtx): Promise<AiResult>;
  suggestFixes(c: PathCtx): Promise<AiResult>;
  chat(q: string, c: ChatCtx): Promise<ChatReply>;
}

const SUGGESTIONS = [
  "Summarize this scan",
  "What are my most critical paths?",
  "What should I fix first?",
  "What is exposed to the internet?",
];

/** Template-based stand-in. Same contract as a real LLM provider; every sentence is built from supplied scan data only. */
class DemoProvider implements AiProvider {
  name = "demo";
  private build(c: PathCtx, kind: "explain" | "fix"): AiResult {
    const { path: p, labels } = c,
      L = (id: string) => labels[id] ?? id,
      pct = (n: number) => Math.round(n * 100);
    const step = (e: any, i: number) => {
      const s = L(e.source),
        t = L(e.target),
        ev = e.evidence.join(", ");
      const text =
        e.type === "reaches"
          ? `${s} is reachable from the internet (${ev}), so an external attacker can contact ${t} directly.`
          : e.type === "uses"
            ? `${s} runs with the identity ${t}, so compromising ${s} lets an attacker act with ${t}'s permissions.`
            : e.type === "can_access"
              ? `${s} has ${e.action ?? "declared"} access to ${t}${e.action === "admin" ? ", which allows full control" : ""} (${ev}).`
              : `${s} ${e.type.replace("_", " ")} ${t} (${ev}).`;
      return { step: i + 1, explanation: text };
    };
    const route =
      p.costRank === 1
        ? "the most likely route to this target"
        : p.costRank
          ? `alternative route #${p.costRank} to this target`
          : "a lower-likelihood route to this target";
    const advice = [
      ...new Set<string>(
        p.findings.map((f: Finding) => ADVICE[f.ruleId]).filter(Boolean),
      ),
    ];
    const first = p.edges[0];
    const confs: number[] = p.edges.map((e: any) => e.confidence);
    return {
      summary:
        kind === "explain"
          ? `${p.id} is a ${p.risk.severity} risk path (score ${p.risk.score}). An attacker starting at ${L(p.entryPoint)} could reach ${L(p.target)} in ${p.edges.length} steps. This is ${route}, with an estimated route likelihood of ${pct(p.likelihood)}%.`
          : `To stop ${p.id}, break any single link between ${L(p.entryPoint)} and ${L(p.target)}. ${advice.length} rule-specific fixes apply to the resources on this path.`,
      step_explanations: p.edges.map(step),
      contributing_findings: p.findings.map(
        (f: Finding) => `${f.title} on ${L(f.resourceId)} (${f.severity})`,
      ),
      remediation_steps: [
        ...advice,
        `Breaking the first link (${L(first.source)} to ${L(first.target)}) removes this path entirely. Use Simulate in the path panel to confirm the effect before changing anything.`,
      ],
      assumptions: [
        "Paths show modeled reachability from the imported configuration. Nothing was exploited or tested against a live system.",
        `Link confidence values range from ${pct(Math.min(...confs))}% to ${pct(Math.max(...confs))}% and come from rule-based estimates.`,
      ],
      uncertainty: p.edges
        .filter((e: any) => e.confidence < 0.95)
        .map(
          (e: any) =>
            `${L(e.source)} to ${L(e.target)} is based on a declared relationship (${pct(e.confidence)}% confidence), not an observed one.`,
        ),
      mode: "demo",
    };
  }
  async explainPath(c: PathCtx) {
    return this.build(c, "explain");
  }
  async suggestFixes(c: PathCtx) {
    return this.build(c, "fix");
  }

  async chat(question: string, c: ChatCtx): Promise<ChatReply> {
    const q = question.toLowerCase(),
      L = (id: string) => c.labels[id] ?? id;
    const sorted = [...c.paths].sort((a, b) => b.risk.score - a.risk.score);
    const reply = (
      answer: string,
      references: ChatReply["references"] = [],
    ): ChatReply => ({
      answer,
      references,
      suggestions: SUGGESTIONS,
      mode: "demo",
    });
    const id = question.match(/AP-\d{3}/i)?.[0].toUpperCase();
    if (id) {
      const p = c.paths.find((x) => x.id === id);
      if (!p)
        return reply(
          `I can't find ${id} in the latest scan. Try asking about the most critical paths.`,
        );
      const r = this.build({ path: p, labels: c.labels }, "explain");
      return reply(
        [
          r.summary,
          ...r.step_explanations.map((s) => `${s.step}. ${s.explanation}`),
          r.remediation_steps[0]
            ? `Suggested fix: ${r.remediation_steps[0]}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        [{ type: "path", id }],
      );
    }
    if (/fix|first|priorit|remediat|recommend|should|reduce/.test(q)) {
      const ranked = rankedOf(c);
      if (!ranked.length)
        return reply(
          "No single change removes an attack path right now, so there is nothing to prioritize.",
        );
      return reply(
        [
          "These changes remove the most attack paths:",
          ...ranked
            .slice(0, 3)
            .map(
              (r, i) =>
                `${i + 1}. ${r.label}: removes ${r.pathsRemoved} path${r.pathsRemoved === 1 ? "" : "s"} (${r.criticalPathsRemoved} critical)`,
            ),
          "Open the Remediation page to preview the effect of each one.",
        ].join("\n"),
      );
    }
    if (/critical|worst|riskiest|highest|top|dangerous/.test(q)) {
      if (!sorted.length)
        return reply("There are no attack paths in the latest scan.");
      return reply(
        [
          "Highest-risk paths:",
          ...sorted
            .slice(0, 3)
            .map(
              (p) =>
                `- ${p.id} (${p.risk.severity}, score ${p.risk.score}): ${p.nodes.map(L).join(" → ")}`,
            ),
        ].join("\n"),
        sorted.slice(0, 3).map((p) => ({ type: "path" as const, id: p.id })),
      );
    }
    if (/exposed|public|internet|external/.test(q)) {
      const pub = c.resources.filter((r) => r.public);
      if (!pub.length)
        return reply(
          "No resource is reachable from the internet in the latest scan.",
        );
      return reply(
        [
          "Internet-facing resources:",
          ...pub.map(
            (r) =>
              `- ${r.name} (${r.subtype}): ${r.pathCount} attack path${r.pathCount === 1 ? "" : "s"}, ${r.findingCount} findings`,
          ),
        ].join("\n"),
        pub.map((r) => ({ type: "resource" as const, id: r.id })),
      );
    }
    if (/summar|overview|posture|status|scan/.test(q)) {
      const crit = c.paths.filter((p) => p.risk.severity === "critical").length;
      return reply(
        `The latest scan covers ${c.resources.length} resources with ${c.findings.length} findings and ${c.paths.length} attack paths, ${crit} of them critical.${sorted[0] ? ` The highest-risk path is ${sorted[0].id}: ${sorted[0].nodes.map(L).join(" → ")}.` : ""}`,
        sorted[0] ? [{ type: "path", id: sorted[0].id }] : [],
      );
    }
    return reply(
      "I can summarize the scan, list the riskiest paths, explain a path by ID (for example AP-001), show what is exposed, or suggest what to fix first. In demo mode I answer from your scan results only.",
    );
  }
}

const SYSTEM =
  "You are a cloud security analyst inside CloudTrace. Use ONLY the JSON facts you are given. Never invent resources, relationships or permissions, never claim anything was exploited, and state uncertainty plainly. Return a JSON object with keys: summary (string), step_explanations (array of {step, explanation}, exactly one per step in order), contributing_findings (string[]), remediation_steps (string[]), assumptions (string[]), uncertainty (string[]).";
const CHAT_SYSTEM =
  "You are the CloudTrace assistant. Answer questions about the user's cloud attack paths using ONLY data returned by the tools. Never invent resources, relationships or permissions, never claim anything was exploited, and say so when the data does not answer the question. Be concise and cite path IDs such as AP-001.";
const Structured = z.object({
  summary: z.string(),
  step_explanations: z.array(
    z.object({ step: z.number(), explanation: z.string() }),
  ),
  contributing_findings: z.array(z.string()),
  remediation_steps: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainty: z.array(z.string()),
});
const fn = (
  name: string,
  description: string,
  properties: object = {},
  required: string[] = [],
) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: { type: "object", properties, required },
  },
});
const TOOLS = [
  fn("list_paths", "List attack paths with id, severity, score and route."),
  fn(
    "get_path",
    "Get one attack path with its steps and findings.",
    { id: { type: "string" } },
    ["id"],
  ),
  fn(
    "list_findings",
    "List security findings, optionally for one resource id.",
    { resourceId: { type: "string" } },
  ),
  fn("list_exposed", "List internet-facing resources."),
  fn("top_fixes", "Single changes ranked by attack paths removed."),
];

/** Tools read the deterministic scan result, so the model fetches facts instead of guessing. */
function runTool(name: string, a: any, c: ChatCtx) {
  const L = (id: string) => c.labels[id] ?? id,
    fin = (f: Finding) => ({
      rule: f.ruleId,
      title: f.title,
      severity: f.severity,
      resource: L(f.resourceId),
    });
  switch (name) {
    case "list_paths":
      return c.paths.map((p) => ({
        id: p.id,
        severity: p.risk.severity,
        score: p.risk.score,
        route: p.nodes.map(L).join(" -> "),
      }));
    case "get_path": {
      const p = c.paths.find((x) => x.id === a.id);
      return p
        ? {
            id: p.id,
            severity: p.risk.severity,
            score: p.risk.score,
            likelihood: p.likelihood,
            steps: p.edges.map((e: any) => ({
              from: L(e.source),
              to: L(e.target),
              relationship: e.type,
              action: e.action,
              evidence: e.evidence,
              confidence: e.confidence,
              mitre: e.mitre?.id,
            })),
            findings: p.findings.map(fin),
          }
        : { error: "not found" };
    }
    case "list_findings":
      return c.findings
        .filter((f) => !a.resourceId || f.resourceId === a.resourceId)
        .map(fin);
    case "list_exposed":
      return c.resources
        .filter((r) => r.public)
        .map((r) => ({ id: r.id, name: r.name, paths: r.pathCount }));
    case "top_fixes":
      return rankedOf(c);
    default:
      return { error: "unknown tool" };
  }
}

/** OpenAI-backed provider. Any failure (network, bad JSON, wrong step count) falls back to the demo provider. */
class OpenAIProvider implements AiProvider {
  name = "openai";
  constructor(
    private key: string,
    private model: string,
    private fallback: AiProvider,
  ) {}
  private async call(messages: unknown[], extra: object = {}) {
    const ctl = new AbortController(),
      t = setTimeout(() => ctl.abort(), 30_000);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages,
          ...extra,
        }),
      });
      if (!r.ok) throw new Error(`OpenAI responded ${r.status}`);
      return (await r.json()).choices[0].message;
    } finally {
      clearTimeout(t);
    }
  }
  private async structured(
    c: PathCtx,
    task: "explain" | "fix",
  ): Promise<AiResult> {
    const L = (id: string) => c.labels[id] ?? id,
      p = c.path;
    const facts = {
      task,
      path: {
        id: p.id,
        severity: p.risk.severity,
        score: p.risk.score,
        entry: L(p.entryPoint),
        target: L(p.target),
        likelihood: p.likelihood,
        steps: p.edges.map((e: any) => ({
          from: L(e.source),
          to: L(e.target),
          relationship: e.type,
          action: e.action,
          evidence: e.evidence,
          confidence: e.confidence,
          mitre: e.mitre?.id,
        })),
      },
      findings: p.findings.map((f: Finding) => ({
        rule: f.ruleId,
        title: f.title,
        severity: f.severity,
        resource: L(f.resourceId),
        standardAdvice: ADVICE[f.ruleId],
      })),
    };
    const msg = await this.call(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(facts) },
      ],
      { response_format: { type: "json_object" } },
    );
    const out = Structured.parse(JSON.parse(msg.content));
    if (out.step_explanations.length !== p.edges.length)
      throw new Error("step count mismatch"); // guards against invented or skipped steps
    return { ...out, mode: "llm" };
  }
  explainPath(c: PathCtx) {
    return this.structured(c, "explain").catch(() =>
      this.fallback.explainPath(c),
    );
  }
  suggestFixes(c: PathCtx) {
    return this.structured(c, "fix").catch(() => this.fallback.suggestFixes(c));
  }
  async chat(q: string, c: ChatCtx): Promise<ChatReply> {
    try {
      const msgs: any[] = [
        { role: "system", content: CHAT_SYSTEM },
        { role: "user", content: q },
      ];
      for (let i = 0; i < 5; i++) {
        const m = await this.call(msgs, { tools: TOOLS });
        msgs.push(m);
        if (!m.tool_calls?.length) {
          const ids = [
            ...new Set<string>((m.content ?? "").match(/AP-\d{3}/g) ?? []),
          ];
          return {
            answer: m.content ?? "",
            references: ids.map((id) => ({ type: "path" as const, id })),
            suggestions: SUGGESTIONS,
            mode: "llm",
          };
        }
        for (const tc of m.tool_calls)
          msgs.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(
              runTool(
                tc.function.name,
                JSON.parse(tc.function.arguments || "{}"),
                c,
              ),
            ),
          });
      }
      throw new Error("too many tool calls");
    } catch {
      return this.fallback.chat(q, c);
    }
  }
}

export function getProvider(): AiProvider {
  const demo = new DemoProvider(),
    key = process.env.OPENAI_API_KEY;
  return process.env.AI_PROVIDER === "openai" && key
    ? new OpenAIProvider(key, process.env.OPENAI_MODEL ?? "gpt-4o-mini", demo)
    : demo;
}
