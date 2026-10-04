import type { SecurityGraph } from "../graph";
import type { AttackPath } from "../attack-path";
import type { Severity } from "../security-rules";

/**
 * CloudTrace project-specific risk model (NOT an industry standard such as CVSS):
 *   Risk = 100 x Exposure x Exploitability x Privilege x Criticality x Confidence
 * All factors are in (0, 1].
 *  - Exposure:       1.0 if the path starts with a direct internet 'reaches' edge, 0.8 from a compromised identity, else 0.5
 *  - Exploitability: mean of per-relationship-type weights along the path (EXPLOIT_WEIGHT)
 *  - Privilege:      highest permission level on any can_access edge (read .5, write .75, admin 1); 0.3 if none
 *  - Criticality:    target criticality (low .25, medium .5, high .8, critical 1.0)
 *  - Confidence:     product of edge confidences
 * Severity: >=60 critical, >=40 high, >=20 medium, >=5 low, else info.
 */
export const EXPLOIT_WEIGHT: Record<string, number> = {
  reaches: 0.9,
  uses: 0.95,
  assumes: 0.8,
  can_access: 0.9,
  connects_to: 0.7,
  runs_on: 0.8,
  exposed_to: 0.9,
  contains: 0.6,
  trusts: 0.7,
};
const PRIV: Record<string, number> = { read: 0.5, write: 0.75, admin: 1 };
const CRIT: Record<string, number> = {
  low: 0.25,
  medium: 0.5,
  high: 0.8,
  critical: 1,
};

export interface RiskResult {
  score: number;
  severity: Severity;
  factors: Record<
    "exposure" | "exploitability" | "privilege" | "criticality" | "confidence",
    number
  >;
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const severityFor = (s: number): Severity =>
  s >= 60
    ? "critical"
    : s >= 40
      ? "high"
      : s >= 20
        ? "medium"
        : s >= 5
          ? "low"
          : "info";

export function scorePath(g: SecurityGraph, p: AttackPath): RiskResult {
  const first = p.edges[0];
  const exposure =
    first.source === "internet" && first.type === "reaches"
      ? 1
      : g.getNodeAttribute(p.entryPoint, "compromised")
        ? 0.8
        : 0.5;
  const exploitability =
    p.edges.reduce((s, e) => s + (EXPLOIT_WEIGHT[e.type] ?? 0.5), 0) /
    p.edges.length;
  const privilege = Math.max(
    0.3,
    ...p.edges.filter((e) => e.action).map((e) => PRIV[e.action!]),
  );
  const criticality =
    CRIT[g.getNodeAttribute(p.target, "criticality") as string];
  const confidence = p.edges.reduce((s, e) => s * e.confidence, 1);
  const score = Math.round(
    100 * exposure * exploitability * privilege * criticality * confidence,
  );
  return {
    score,
    severity: severityFor(score),
    factors: {
      exposure,
      exploitability: r3(exploitability),
      privilege,
      criticality,
      confidence: r3(confidence),
    },
  };
}
