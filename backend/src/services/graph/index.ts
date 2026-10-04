import Graph from "graphology";
import type { Environment, EdgeType, Resource } from "../parser";

export interface EdgeMeta {
  type: EdgeType;
  confidence: number;
  evidence: string[];
  action?: "read" | "write" | "admin";
}
export type SecurityGraph = Graph;
export const INTERNET = "internet";
/** Structural edges describe placement, not attacker movement, so path search ignores them. */
export const STRUCTURAL = new Set<string>(["contains", "runs_on"]);
export const isNetworkObject = (r: { subtype: string }) =>
  ["vpc", "subnet", "security_group"].includes(r.subtype);

interface Ingress {
  port: number;
  source: string;
}
const ingressOf = (r: Resource): Ingress[] =>
  Array.isArray(r.properties.ingress)
    ? (r.properties.ingress as Ingress[])
    : [];
const sgsOf = (r: Resource): string[] =>
  Array.isArray(r.properties.securityGroups)
    ? (r.properties.securityGroups as string[])
    : [];

/**
 * Builds a directed multigraph. Every edge carries type, confidence and evidence (why it exists).
 *  - Internet -> resource ('reaches') when public AND (no security group, or one allows internet ingress)
 *  - declared relationships, and permissions as 'can_access' edges
 *  - security-group ingress between groups becomes 'connects_to' lateral-movement edges between member workloads
 */
export function buildGraph(env: Environment): SecurityGraph {
  const g = new Graph({ type: "directed", multi: true });
  const byId = new Map(env.resources.map((r) => [r.id, r]));
  const runsOn = (r?: Resource) =>
    r?.relationships.find((x) => x.type === "runs_on")?.target;
  g.addNode(INTERNET, {
    type: "entry",
    subtype: "internet",
    label: "Internet",
    criticality: "low",
    entry: true,
  });
  for (const r of env.resources) {
    const parent = byId.get(runsOn(r) ?? "");
    const subnet =
      r.subtype === "subnet"
        ? undefined
        : parent?.subtype === "subnet"
          ? parent.id
          : undefined;
    const vpc =
      r.subtype === "vpc"
        ? undefined
        : parent?.subtype === "vpc"
          ? parent.id
          : runsOn(byId.get(subnet ?? ""));
    const compromised = r.properties.compromised === true;
    g.addNode(r.id, {
      type: r.type,
      subtype: r.subtype,
      label: r.name,
      criticality: r.criticality,
      public: r.public,
      compromised,
      entry: compromised,
      subnet,
      vpc,
    });
  }
  const add = (s: string, t: string, m: EdgeMeta, suffix = "") => {
    const k = `${s}|${m.type}|${t}|${m.action ?? suffix}`;
    if (!g.hasEdge(k)) g.addEdgeWithKey(k, s, t, m);
  };

  for (const r of env.resources) {
    if (r.public) {
      const sgs = sgsOf(r).map((id) => byId.get(id)!),
        open = sgs.flatMap(ingressOf).filter((i) => i.source === "internet");
      if (!sgs.length || open.length)
        add(INTERNET, r.id, {
          type: "reaches",
          confidence: 0.98,
          evidence: [
            "PUBLIC_RESOURCE",
            ...new Set(open.map((i) => `SG_INGRESS_${i.port}`)),
          ],
        });
    }
    for (const rel of r.relationships)
      add(r.id, rel.target, {
        type: rel.type,
        confidence: 0.9,
        evidence: ["DECLARED_RELATIONSHIP"],
      });
    for (const p of r.permissions)
      add(r.id, p.target, {
        type: "can_access",
        confidence: 0.95,
        evidence: [`PERMISSION_${p.action.toUpperCase()}`],
        action: p.action,
      });
  }
  const members = new Map<string, Resource[]>();
  for (const r of env.resources)
    for (const sg of sgsOf(r)) members.set(sg, [...(members.get(sg) ?? []), r]);
  for (const sg of env.resources.filter((x) => x.subtype === "security_group"))
    for (const rule of ingressOf(sg)) {
      if (rule.source === "internet") continue;
      for (const a of members.get(rule.source) ?? [])
        for (const b of members.get(sg.id) ?? [])
          if (a.id !== b.id)
            add(
              a.id,
              b.id,
              {
                type: "connects_to",
                confidence: 0.8,
                evidence: [`SG_INGRESS_${rule.port}`, `SG:${sg.id}`],
              },
              String(rule.port),
            );
    }
  return g;
}

/** Serializes to the API response shape in the PRD (section 31), plus placement and entry metadata. */
export function toGraphJson(g: SecurityGraph) {
  return {
    nodes: g.mapNodes((id, a) => ({
      id,
      type: a.type,
      subtype: a.subtype,
      label: a.label,
      subnet: a.subnet,
      vpc: a.vpc,
      entry: !!a.entry,
      compromised: !!a.compromised,
    })),
    edges: g.mapEdges((key, a, s, t) => ({
      id: key,
      source: s,
      target: t,
      relationship: a.type,
      confidence: a.confidence,
      evidence: a.evidence,
      action: a.action,
      structural: STRUCTURAL.has(a.type),
    })),
  };
}
