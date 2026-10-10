import { parseEnvironment } from "./services/parser";
import { evaluateRules } from "./services/security-rules";
import { buildGraph, toGraphJson } from "./services/graph";
import { findAttackPathsEx } from "./services/attack-path";
import { mitreFor } from "./services/attack-path/mitre";
import { scorePath } from "./services/risk";

/** Full deterministic pipeline: validate -> rules -> graph -> paths -> risk. No LLM involved. */
export function analyze(raw: unknown) {
  const env = parseEnvironment(raw);
  const findings = evaluateRules(env);
  const graph = buildGraph(env);
  const { paths: found, truncated } = findAttackPathsEx(graph);
  const paths = found
    .map((p) => ({
      ...p,
      edges: p.edges.map((e) => ({
        ...e,
        mitre: mitreFor(e, graph.getNodeAttribute(e.target, "type")),
      })),
      risk: scorePath(graph, p),
      findings: findings.filter((f) => p.nodes.includes(f.resourceId)),
    }))
    .sort((a, b) => b.risk.score - a.risk.score || a.id.localeCompare(b.id));
  // Choke points: intermediate nodes that many attack paths pass through. Fixing one breaks all of them.
  // Parallel edges (read vs admin on one target) share a node route, so each distinct route counts once.
  const routes = new Map<string, string[]>();
  for (const p of paths) routes.set(p.nodes.join(">"), p.nodes);
  const count = new Map<string, number>();
  for (const nodes of routes.values())
    for (const n of nodes.slice(1, -1)) count.set(n, (count.get(n) ?? 0) + 1);
  const chokePoints = [...count]
    .filter(([, c]) => c >= 2)
    .map(([id, c]) => ({
      id,
      paths: c,
      share: Math.round((c / routes.size) * 100) / 100,
    }))
    .sort((a, b) => b.paths - a.paths || a.id.localeCompare(b.id))
    .slice(0, 6);
  return {
    environment: env.name,
    resources: env.resources.length,
    findings,
    graph: toGraphJson(graph),
    paths,
    chokePoints,
    truncated,
  };
}
