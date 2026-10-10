import {
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type EdgeProps,
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
import { layoutGraph, type Dir, type Pt } from "../../lib/graphLayout";
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

export const SELECT = "var(--graph-select)",
  NEUTRAL = "var(--graph-neutral)";
/** Relationship type decides the line style (same idea as a risk graph legend). Severity decides weight and brightness. */
export const EDGE_STYLE: Record<
  string,
  { color: string; dash?: string; label: string }
> = {
  reaches: { color: "var(--color-crit)", dash: "2 5", label: "Internet exposure" },
  connects_to: {
    color: "var(--edge-lateral)",
    dash: "2 5",
    label: "Possible lateral movement",
  },
  can_access: { color: "var(--edge-access)", label: "Access to resources" },
  uses: { color: "var(--edge-identity)", label: "Identity use" },
  assumes: { color: "var(--edge-identity)", label: "Identity use" },
  trusts: { color: "var(--edge-identity)", label: "Identity use" },
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
export const typeLabel = (sub: string) =>
  TYPE_LABEL[sub] ??
  sub.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
/** Icon tint encodes resource type; ring colour encodes the highest risk of any path through the resource. */
export const TINT: Record<string, string> = {
  entry: "var(--type-entry)",
  compute: "var(--type-compute)",
  identity: "var(--type-identity)",
  storage: "var(--type-storage)",
  database: "var(--type-database)",
  secret: "var(--type-secret)",
  api: "var(--type-api)",
  network: "var(--type-network)",
};

export interface NData {
  label: string;
  type: string;
  subtype: string;
  ring: string;
  tint: string;
  dim: boolean;
  /** Not connected to the hovered element: slightly faded, never hidden. */
  soft?: boolean;
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
      className={`relative transition-opacity duration-150 ${d.dim ? "opacity-25" : d.soft ? "opacity-60" : ""}`}
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
          background: entry
            ? "var(--type-entry)"
            : `color-mix(in srgb, ${d.tint} 20%, var(--color-panel))`,
          borderWidth: d.size > 48 ? 3 : 2,
        }}
        className="flex h-full w-full items-center justify-center rounded-full border-solid"
      >
        <Icon
          size={Math.round(d.size * 0.44)}
          style={{ color: entry ? "var(--on-entry)" : d.tint }}
        />
      </div>
      {d.star && (
        <span
          title="Sensitive resource"
          className="absolute -left-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg text-accent"
        >
          <Star size={11} fill="currentColor" />
        </span>
      )}
      {d.exposed && (
        <span
          title="Reachable from the internet"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg text-crit"
        >
          <AlertTriangle
            size={12}
            fill="currentColor"
            className="text-crit [&>*]:stroke-[var(--color-bg)]"
          />
        </span>
      )}
      {d.choke > 0 && (
        <span
          title={`${d.choke} attack paths pass through this resource`}
          className="absolute -bottom-1 -right-3.5 rounded bg-brand px-1 text-[10px] font-semibold leading-4 text-on-brand"
        >
          ×{d.choke}
        </span>
      )}
      <div className="pointer-events-none absolute left-1/2 top-full mt-1.5 flex w-40 -translate-x-1/2 justify-center">
        {/* the pill keeps lines that pass behind the label from cutting through the text */}
        <div className="max-w-full rounded bg-bg/90 px-1.5 py-0.5 text-center">
          <div className="truncate text-xs font-semibold text-heading">
            {d.type === "entry" ? "Internet" : typeLabel(d.subtype)}
          </div>
          {d.type !== "entry" && (
            <div className="truncate text-[11px] text-muted">{d.label}</div>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={d.dir === "LR" ? Position.Right : Position.Bottom}
        className={h}
      />
    </div>
  );
}
/**
 * Edge drawn through the lanes the layout reserved for it. Each hop is a cubic curve with tangents along the layer axis,
 * so lines leave and enter nodes straight, change lanes smoothly, and never cut across other nodes.
 */
export function RoutedEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd,
  style,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  interactionWidth,
}: EdgeProps) {
  const d = (data ?? {}) as { points?: Pt[]; dir?: Dir; offset?: number };
  const vertical = d.dir === "TB",
    off = d.offset ?? 0;
  const pts: Pt[] = [
    { x: sourceX, y: sourceY },
    ...(d.points ?? []).map((p) => ({
      x: vertical ? p.x + off : p.x,
      y: vertical ? p.y : p.y + off,
    })),
    { x: targetX, y: targetY },
  ];
  const seg = (a: Pt, b: Pt) => {
    const span = Math.abs(vertical ? b.y - a.y : b.x - a.x),
      k = Math.max(span * 0.5, 48);
    const sign = (vertical ? b.y - a.y : b.x - a.x) >= 0 ? 1 : 1;
    return vertical
      ? { c1: { x: a.x + off, y: a.y + k * sign }, c2: { x: b.x + off, y: b.y - k * sign } }
      : { c1: { x: a.x + k * sign, y: a.y + off }, c2: { x: b.x - k * sign, y: b.y + off } };
  };
  let path = `M ${pts[0].x} ${pts[0].y}`;
  const segs = pts.slice(1).map((b, i) => ({ a: pts[i], b, ...seg(pts[i], b) }));
  for (const s of segs)
    path += ` C ${s.c1.x} ${s.c1.y}, ${s.c2.x} ${s.c2.y}, ${s.b.x} ${s.b.y}`;
  // label sits on a lane point, or at the middle of the single curve
  let lx: number, ly: number;
  if (segs.length % 2 === 0) {
    lx = pts[segs.length / 2].x;
    ly = pts[segs.length / 2].y;
  } else {
    const m = segs[(segs.length - 1) / 2];
    lx = (m.a.x + 3 * m.c1.x + 3 * m.c2.x + m.b.x) / 8;
    ly = (m.a.y + 3 * m.c1.y + 3 * m.c2.y + m.b.y) / 8;
  }
  return (
    <BaseEdge
      path={path}
      labelX={lx}
      labelY={ly}
      label={label}
      labelStyle={labelStyle}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={interactionWidth ?? 16}
    />
  );
}
export const edgeTypes = { routed: RoutedEdge };

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
  /** Turns off the animated dash on the selected path. */
  reduceMotion?: boolean;
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
    reduceMotion,
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
  const { pos, routes } = layoutGraph(
      g,
      dir,
      keep ?? (showAll ? undefined : new Set(all.flatMap((p) => p.nodes))),
    );
  const targets = new Set(all.map((p) => p.target));
  // Several edges between the same two resources (for example read and admin) are fanned out a little so each stays visible.
  const pairs = new Map<string, string[]>();
  for (const e of g.edges) {
    const k = [e.source, e.target].sort().join("|");
    (pairs.get(k) ?? pairs.set(k, []).get(k)!).push(e.id);
  }
  const fan = (e: GraphEdge) => {
    const list = pairs.get([e.source, e.target].sort().join("|"))!;
    return (list.indexOf(e.id) - (list.length - 1) / 2) * 10;
  };
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
            : `color-mix(in srgb, ${tint} 60%, transparent)`;
        return {
          id: n.id,
          type: "resource",
          // layout gives centres; React Flow wants the top-left corner
          position: {
            x: pos.get(n.id)!.x - size / 2,
            y: pos.get(n.id)!.y - size / 2,
          },
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
            : sev === "critical" || sev === "high"
              ? 1
              : sev
                ? 0.88
                : 0.55;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "routed",
          data: { points: routes.get(e.id) ?? [], dir, offset: fan(e) },
          zIndex: sel ? 20 : sev === "critical" ? 4 : sev === "high" ? 3 : sev ? 2 : 1,
          animated: sel && !reduceMotion,
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
          labelStyle: { fill: "var(--color-fg)", fontSize: 11 },
          labelBgStyle: { fill: "var(--graph-label-bg)" },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 3,
        };
      }),
  };
}
