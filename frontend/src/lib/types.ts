export type Severity = "info" | "low" | "medium" | "high" | "critical";
export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  hasPassword?: boolean;
  googleLinked?: boolean;
  createdAt?: string;
}
export interface Summary {
  resources: number;
  findings: number;
  paths: number;
  criticalPaths: number;
}
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  provider: string;
  environmentName: string | null;
  hasEnvironment?: boolean;
  lastScanAt: string | null;
  summary: Summary | null;
  createdAt?: string;
}
export interface Finding {
  ruleId: string;
  resourceId: string;
  title: string;
  severity: Severity;
  description: string;
}
export interface ResourceRow {
  subnet?: string;
  vpc?: string;
  id: string;
  name: string;
  type: string;
  subtype: string;
  public: boolean;
  criticality: string;
  findingCount: number;
  pathCount: number;
}
export interface GraphNode {
  id: string;
  type: string;
  subtype: string;
  label: string;
  subnet?: string;
  vpc?: string;
  entry: boolean;
  compromised: boolean;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  confidence: number;
  evidence: string[];
  action?: string;
  structural: boolean;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export interface Mitre {
  id: string;
  name: string;
}
export interface PathEdge {
  mitre?: Mitre;
  key: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  evidence: string[];
  action?: string;
}
export interface Risk {
  score: number;
  severity: Severity;
  factors: Record<
    "exposure" | "exploitability" | "privilege" | "criticality" | "confidence",
    number
  >;
}
export interface AttackPath {
  id: string;
  entryPoint: string;
  target: string;
  nodes: string[];
  edges: PathEdge[];
  isShortest: boolean;
  cost: number;
  likelihood: number;
  costRank: number | null;
  risk: Risk;
  findings: Finding[];
}
export interface ScanRow {
  id: string;
  completedAt: string | null;
  summary: Summary | null;
}
export const SEV_ORDER: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};
export interface AiResult {
  summary: string;
  step_explanations: { step: number; explanation: string }[];
  contributing_findings: string[];
  remediation_steps: string[];
  assumptions: string[];
  uncertainty: string[];
  mode: "demo" | "llm";
}
export type Change =
  | { type: "make_private"; resourceId: string }
  | {
      type: "remove_permission";
      resourceId: string;
      target: string;
      action?: string;
    }
  | {
      type: "remove_relationship";
      resourceId: string;
      relType: string;
      target: string;
    };
export interface Snapshot {
  paths: number;
  critical: number;
  findings: number;
}
export interface PathRef {
  id: string;
  nodes: string[];
  severity: Severity;
  score: number;
}
export interface WhatIf {
  change: Change;
  label: string;
  before: Snapshot;
  after: Snapshot;
  removed: PathRef[];
  added: PathRef[];
  changed: { id: string; nodes: string[]; from: number; to: number }[];
  targetsProtected: string[];
  targetsStillReachable: string[];
}
export interface Remediation {
  change: Change;
  label: string;
  pathsRemoved: number;
  criticalPathsRemoved: number;
  riskReduction: number;
}
export interface ChatReply {
  answer: string;
  references: { type: "path" | "resource"; id: string }[];
  suggestions: string[];
  mode: string;
}
export interface ChokePoint {
  id: string;
  paths: number;
  share: number;
}
export interface Diff {
  previousAt: string;
  currentAt: string;
  newPaths: PathRef[];
  resolvedPaths: PathRef[];
  scoreChanges: { id: string; nodes: string[]; from: number; to: number }[];
}
export type FindingStatus = "open" | "acknowledged" | "fixed" | "accepted";
export interface FindingState {
  ruleId: string;
  resourceId: string;
  status: FindingStatus;
  note: string | null;
  updatedAt?: string;
}
export interface AuthConfig {
  google: string | null;
  emailDelivery: boolean;
  ai: "demo" | "llm";
}
