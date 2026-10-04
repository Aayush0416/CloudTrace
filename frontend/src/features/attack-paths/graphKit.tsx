import {
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  AlertTriangle,
  Archive,
  Database,
  Globe,
  KeyRound,
  Lock,
  Network,
  Plug,
  Server,
  Star,
  User,
  UserX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { layoutGraph, type Dir } from "../../lib/graphLayout";
import {
  SEV_ORDER,
  type AttackPath,
  type GraphData,
  type GraphEdge,
  type ResourceRow,
  type Severity,
} from "../../lib/types";
import { SEV } from "../../components/ui";

/** Placement objects are used for scope and context, never drawn as attacker steps. */
export const HIDDEN = new Set(["vpc", "subnet", "security_group"]);
export const visibleGraph = (g: GraphData): GraphData => {
  const nodes = g.nodes.filter((n) => !HIDDEN.has(n.subtype)),
    ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: g.edges.filter(
      (e) => !e.structural && ids.has(e.source) && ids.has(e.target),
    ),
  };
};

export const SELECT = "#ffffff",
  NEUTRAL = "#34507f";
/** Relationship type decides the line style (same idea as a risk graph legend). Severity decides weight and brightness. */
export const EDGE_STYLE: Record<
  string,
  { color: string; dash?: string; label: string }
> = {
  reaches: { color: "#ff4d4f", dash: "2 5", label: "Internet exposure" },
  connects_to: {
    color: "#fca311",
    dash: "2 5",
    label: "Possible lateral movement",
  },
  can_access: { color: "#22c8e8", label: "Access to resources" },
  uses: { color: "#8a96ad", label: "Identity use" },
  assumes: { color: "#8a96ad", label: "Identity use" },
  trusts: { color: "#8a96ad", label: "Identity use" },
};
const ICONS: Record<string, LucideIcon> = {
  entry: Globe,
  compute: Server,
  identity: KeyRound,
  storage: Archive,
  database: Database,
  secret: Lock,
  api: Plug,
  network: Network,
};
const SUB: Record<string, LucideIcon> = {
  lambda: Zap,
  load_balancer: Network,
  iam_user: User,
  kms: Lock,
};
const TYPE_LABEL: Record<string, string> = {
  ec2: "EC2 instance",
  lambda: "Lambda function",
  iam_role: "IAM role",
  iam_user: "IAM user",
  s3: "S3 bucket",
  rds: "RDS database",
  secrets_manager: "Secret",
  kms: "KMS key",
  api_gateway: "API gateway",
  load_balancer: "Load balancer",
  internet: "Internet",
};
const typeLabel = (sub: string) =>
  TYPE_LABEL[sub] ??
  sub.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
/** Icon tint encodes resource type; ring colour encodes the highest risk of any path through the resource. */
export const TINT: Record<string, string> = {
  entry: "#e5e5e5",
  compute: "#6ea8fe",
  identity: "#c4a1ff",
  storage: "#5fd3a1",
  database: "#ff8fa3",
  secret: "#f4c95d",
  api: "#7bdff2",
  network: "#97a3ba",
};

export interface NData {
  label: string;
  type: string;
  subtype: string;
  ring: string;
  tint: string;
  dim: boolean;
  star: boolean;
  exposed: boolean;
  dir: Dir;
  compromised: boolean;
  choke: number;
  size: number;
  [k: string]: unknown;
}

export function ResourceNode({ data }: NodeProps) {
  const d = data as NData,
    entry = d.type === "entry" && !d.compromised,
    Icon = d.compromised
      ? UserX
      : d.type === "entry"
        ? Globe
        : (SUB[d.subtype] ?? ICONS[d.type] ?? Server);
  const h = "pointer-events-none !h-1 !w-1 !border-0 !bg-transparent";
  return (
    <div
      className={`relative ${d.dim ? "opacity-25" : ""}`}
      style={{ width: d.size, height: d.size }}
    >
      <Handle
        type="target"
        position={d.dir === "LR" ? Position.Left : Position.Top}
        className={h}
      />
      <div
        style={{
          borderColor: entry ? "transparent" : d.ring,
          background: entry ? "#e5e5e5" : `${d.tint}1f`,
          borderWidth: d.size > 48 ? 3 : 2,
        }}
        className="flex h-full w-full items-center justify-center rounded-full border-solid"
      >
        <Icon
          size={Math.round(d.size * 0.44)}
          style={{ color: entry ? "#000" : d.tint }}
        />
      </div>
      {d.star && (
        <span
          title="Sensitive resource"
          className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-accent"
        >
          <Star size={11} fill="currentColor" />
        </span>
      )}
      {d.exposed && (
        <span
          title="Reachable from the internet"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-crit"
        >
          <AlertTriangle
            size={12}
            fill="currentColor"
            className="text-crit [&>*]:stroke-black"
          />
        </span>
      )}
      {d.choke > 0 && (
        <span
          title={`${d.choke} attack paths pass through this resource`}
          className="absolute -bottom-1 -right-3.5 rounded bg-accent px-1 text-[10px] font-semibold leading-4 text-bg"
        >
          ×{d.choke}
        </span>
      )}
      <div className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-36 -translate-x-1/2 text-center">
        <div className="truncate text-xs font-semibold text-white">
          {d.type === "entry" ? "Internet" : typeLabel(d.subtype)}
        </div>
        {d.type !== "entry" && (
          <div className="truncate text-[11px] text-muted">{d.label}</div>
        )}
      </div>
      <Handle
        type="source"
        position={d.dir === "LR" ? Position.Right : Position.Bottom}
        className={h}
      />
    </div>
  );
}
export const nodeTypes = { resource: ResourceNode };

export interface FlowOpts {
  g: GraphData;
  resources: ResourceRow[];
  all: AttackPath[];
  filtered: AttackPath[];
  selected: AttackPath | null;
  hood: string | null;
  scope: string;
  choke: Map<string, number>;
  dir: Dir;
  showAll: boolean;
  mode: "all" | "critical";
  keep?: Set<string>;
}

/**
 * Turns the analysis into React Flow nodes and edges. Every branch is drawn.
 * Line style = relationship type. Critical and high branches are thicker and brighter. Node size reflects importance.
 * "critical" mode dims everything not on a critical or high path. A selected path overrides both and is drawn in white.
 */
export function buildFlow(o: FlowOpts): { nodes: Node[]; edges: Edge[] } {
  const {
    g,
    resources,
    all,
    filtered,
    selected,
    hood,
    scope,
    choke,
    dir,
    showAll,
    mode,
    keep,
  } = o;
  const nodeSev = new Map<string, Severity>(),
    edgeSev = new Map<string, Severity>();
  const bump = (m: Map<string, Severity>, k: string, s: Severity) => {
    if (!m.has(k) || SEV_ORDER[s] > SEV_ORDER[m.get(k)!]) m.set(k, s);
  };
  for (const p of filtered) {
    for (const n of p.nodes.slice(1)) bump(nodeSev, n, p.risk.severity);
    for (const e of p.edges) bump(edgeSev, e.key, p.risk.severity);
  }
  const urgent = filtered.filter(
      (p) => p.risk.severity === "critical" || p.risk.severity === "high",
    ),
    uNodes = new Set(urgent.flatMap((p) => p.nodes)),
    uEdges = new Set(urgent.flatMap((p) => p.edges.map((e) => e.key)));
  const pos = layoutGraph(
      g,
      dir,
      keep ?? (showAll ? undefined : new Set(all.flatMap((p) => p.nodes))),
    ),
    targets = new Set(all.map((p) => p.target));
  const hoodSet = hood
    ? new Set([
        hood,
        ...g.edges
          .filter((e) => e.source === hood || e.target === hood)
          .flatMap((e) => [e.source, e.target]),
      ])
    : null;
  const scopeSet = scope
    ? new Set(
        resources
          .filter((r) => r.vpc === scope || r.subnet === scope)
          .map((r) => r.id),
      )
    : null;
  const selN = selected ? new Set(selected.nodes) : null,
    selE = selected ? new Set(selected.edges.map((e) => e.key)) : null;
  const crit = mode === "critical" && !selected && !hoodSet && !scopeSet,
    focusing = !!(selected || hoodSet || scopeSet || crit);
  const nodeOn = (id: string) =>
    selN
      ? selN.has(id)
      : hoodSet
        ? hoodSet.has(id)
        : scopeSet
          ? scopeSet.has(id)
          : crit
            ? uNodes.has(id)
            : true;
  const edgeOn = (e: GraphEdge) =>
    selE
      ? selE.has(e.id)
      : hoodSet
        ? e.source === hood || e.target === hood
        : scopeSet
          ? scopeSet.has(e.source) && scopeSet.has(e.target)
          : crit
            ? uEdges.has(e.id)
            : true;
  return {
    nodes: g.nodes
      .filter((n) => pos.has(n.id))
      .map<Node>((n) => {
        const r = resources.find((x) => x.id === n.id),
          sev = nodeSev.get(n.id),
          tint = TINT[n.type] ?? TINT.network,
          c = choke.get(n.id) ?? 0;
        const size =
          n.type === "entry"
            ? 50
            : targets.has(n.id)
              ? 54
              : c >= 3
                ? 50
                : n.type === "identity"
                  ? 38
                  : 44;
        const ring = selN?.has(n.id)
          ? SELECT
          : sev && (!crit || uNodes.has(n.id))
            ? SEV[sev].hex
            : `${tint}99`;
        return {
          id: n.id,
          type: "resource",
          position: pos.get(n.id)!,
          initialWidth: size,
          initialHeight: size,
          data: {
            label: n.label,
            type: n.type,
            subtype: n.subtype,
            ring,
            tint,
            dim: focusing && !nodeOn(n.id),
            star: targets.has(n.id),
            exposed: !!r?.public,
            dir,
            compromised: n.compromised,
            choke: c,
            size,
          } as NData,
        };
      }),
    edges: g.edges
      .filter((e) => pos.has(e.source) && pos.has(e.target))
      .map<Edge>((e) => {
        const on = edgeOn(e),
          sev = edgeSev.get(e.id),
          st = EDGE_STYLE[e.relationship] ?? EDGE_STYLE.uses,
          sel = !!selE && on;
        const width = sel
            ? 3
            : sev === "critical"
              ? 2.6
              : sev === "high"
                ? 2.1
                : sev
                  ? 1.7
                  : 1.2,
          col = sel ? SELECT : st.color;
        const opacity =
          focusing && !on
            ? 0.1
            : sev === "critical"
              ? 1
              : sev === "high"
                ? 0.95
                : sev
                  ? 0.75
                  : 0.4;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "default",
          animated: sel,
          label:
            on && (selE || hoodSet)
              ? `${e.relationship.replace("_", " ")}${e.action ? ` (${e.action})` : ""}`
              : undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: col,
            width: 14,
            height: 14,
          },
          style: {
            stroke: col,
            strokeWidth: width,
            strokeDasharray: st.dash,
            strokeLinecap: "round",
            opacity,
          },
          labelStyle: { fill: "#e5e5e5", fontSize: 11 },
          labelBgStyle: { fill: "#000" },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 3,
        };
      }),
  };
}
