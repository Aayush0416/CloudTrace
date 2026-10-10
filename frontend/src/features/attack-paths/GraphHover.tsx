import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Edge, Node } from "@xyflow/react";
import { SEV } from "../../components/ui";
import type {
  AttackPath,
  GraphData,
  ResourceRow,
  Severity,
} from "../../lib/types";
import { EDGE_STYLE, typeLabel } from "./graphKit";

type Target = { kind: "node" | "edge"; id: string } | null;

const RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Plain-language form of the evidence codes the engine attaches to every edge. */
const evidenceText = (code: string) => {
  if (code === "PUBLIC_RESOURCE") return "Resource is marked public";
  if (code === "DECLARED_RELATIONSHIP") return "Relationship declared in the environment";
  if (code.startsWith("PERMISSION_")) return `Permission: ${code.slice(11).toLowerCase()}`;
  if (code.startsWith("SG_INGRESS_")) return `Security group allows port ${code.slice(11)}`;
  if (code.startsWith("SG:")) return `Through security group ${code.slice(3)}`;
  return code;
};
const EDGE_TITLE: Record<string, string> = {
  reaches: "Reachable from the internet",
  connects_to: "Possible lateral movement",
  can_access: "Access to a resource",
  uses: "Runs with this identity",
  assumes: "Can assume this role",
  trusts: "Trust relationship",
  exposed_to: "Exposed to",
};

const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right font-medium text-fg">{children}</dd>
  </div>
);

/**
 * Hover support for a React Flow graph: a tooltip with the facts about the element under the pointer, and a highlight that
 * softens everything not connected to it. Works from the data the page already holds, no extra requests.
 *
 * Usage: spread `bind` on <ReactFlow> and render `tip` next to it. Nothing about the nodes and edges changes.
 */
export function useGraphHover(o: {
  g: GraphData;
  resources: ResourceRow[];
  paths?: AttackPath[];
  choke?: Map<string, number>;
}) {
  const { g, resources, paths = [], choke } = o;
  const [target, setTarget] = useState<Target>(null);
  const last = useRef({ x: 0, y: 0 });
  const tipRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = tipRef.current;
    if (!el) return;
    const { x, y } = last.current,
      w = el.offsetWidth,
      h = el.offsetHeight;
    let L = x + 16,
      T = y + 16;
    if (L + w > window.innerWidth - 8) L = x - w - 16;
    if (T + h > window.innerHeight - 8) T = y - h - 16;
    el.style.transform = `translate(${Math.max(8, L)}px, ${Math.max(8, T)}px)`;
  }, []);
  useLayoutEffect(() => {
    if (target) place();
  }, [target, place]);

  const node = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);
  const res = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);
  const edge = useMemo(() => new Map(g.edges.map((e) => [e.id, e])), [g]);
  // facts derived from the attack paths: which paths use a node or edge, and the worst of them
  const use = useMemo(() => {
    const nodes = new Map<string, { n: number; sev: Severity; score: number }>(),
      edges = new Map<string, { n: number; sev: Severity; score: number }>(),
      mitre = new Map<string, { id: string; name: string }>();
    const bump = (m: typeof nodes, k: string, p: AttackPath) => {
      const c = m.get(k) ?? { n: 0, sev: "info" as Severity, score: 0 };
      c.n++;
      if (RANK[p.risk.severity] > RANK[c.sev] || (p.risk.severity === c.sev && p.risk.score > c.score)) {
        c.sev = p.risk.severity;
        c.score = p.risk.score;
      }
      m.set(k, c);
    };
    for (const p of paths) {
      p.nodes.forEach((id) => bump(nodes, id, p));
      p.edges.forEach((e) => {
        bump(edges, e.key, p);
        if (e.mitre) mitre.set(e.key, e.mitre);
      });
    }
    return { nodes, edges, mitre };
  }, [paths]);
  const targets = useMemo(() => new Set(paths.map((p) => p.target)), [paths]);

  const pathUse = (u?: { n: number; sev: Severity; score: number }) =>
    u ? (
      <Row k="On attack paths">
        {u.n}{" "}
        <span style={{ color: SEV[u.sev].hex }}>
          (worst: {SEV[u.sev].label.toLowerCase()}, {u.score})
        </span>
      </Row>
    ) : (
      <Row k="On attack paths">none</Row>
    );

  let body: ReactNode = null;
  if (target?.kind === "node") {
    const n = node.get(target.id),
      r = res.get(target.id);
    if (n) {
      const isNet = n.type === "entry";
      const exposure = isNet
        ? "External attackers"
        : n.compromised
          ? "Credentials exposed (entry point)"
          : r?.public
            ? "Public"
            : "Private";
      body = (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-heading">{n.label}</div>
              <div className="text-xs text-muted">
                {isNet ? "Entry point" : typeLabel(n.subtype)} · <span className="font-mono">{n.id}</span>
              </div>
            </div>
            {targets.has(n.id) && (
              <span className="shrink-0 rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-on-brand">
                Sensitive
              </span>
            )}
          </div>
          <dl className="mt-2 space-y-1 border-t border-line pt-2">
            <Row k="Exposure">{exposure}</Row>
            {r && <Row k="Criticality">{r.criticality}</Row>}
            {(r?.vpc || r?.subnet) && (
              <Row k="Network">{[r.vpc, r.subnet].filter(Boolean).join(" / ")}</Row>
            )}
            {r && <Row k="Findings">{r.findingCount}</Row>}
            {pathUse(use.nodes.get(n.id))}
            {(choke?.get(n.id) ?? 0) >= 2 && (
              <Row k="Choke point">{choke!.get(n.id)} paths pass here</Row>
            )}
          </dl>
        </>
      );
    }
  } else if (target?.kind === "edge") {
    const e = edge.get(target.id);
    if (e) {
      const name = (id: string) => node.get(id)?.label ?? id;
      const m = use.mitre.get(e.id);
      body = (
        <>
          <div className="flex items-center gap-2">
            <svg width="26" height="6" aria-hidden className="shrink-0">
              <line
                x1="1" y1="3" x2="25" y2="3"
                stroke={EDGE_STYLE[e.relationship]?.color ?? "var(--edge-identity)"}
                strokeWidth="2"
                strokeDasharray={EDGE_STYLE[e.relationship]?.dash}
                strokeLinecap="round"
              />
            </svg>
            <div className="font-semibold text-heading">
              {EDGE_TITLE[e.relationship] ?? e.relationship}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted">
            {name(e.source)} → {name(e.target)}
          </div>
          <dl className="mt-2 space-y-1 border-t border-line pt-2">
            {e.action && <Row k="Permission">{e.action}</Row>}
            <Row k="Confidence">{Math.round(e.confidence * 100)}%</Row>
            {m && <Row k="ATT&CK">{m.id} {m.name}</Row>}
            {pathUse(use.edges.get(e.id))}
          </dl>
          {e.evidence.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 border-t border-line pl-4 pt-2 text-xs text-muted">
              {e.evidence.map((c) => (
                <li key={c}>{evidenceText(c)}</li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }

  // The highlight is a small stylesheet scoped to this graph, NOT a change to the nodes and edges handed to React Flow.
  // Replacing node objects makes React Flow discard its measurements, which made lines attached to them disappear.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const cls = `hl${uid}`;
  const highlight = useMemo(() => {
    if (!target) return null;
    const keepN = new Set<string>(),
      keepE = new Set<string>();
    if (target.kind === "node") {
      keepN.add(target.id);
      for (const e of g.edges)
        if (e.source === target.id || e.target === target.id) {
          keepE.add(e.id);
          keepN.add(e.source);
          keepN.add(e.target);
        }
    } else {
      const e = g.edges.find((x) => x.id === target.id);
      if (e) {
        keepE.add(e.id);
        keepN.add(e.source);
        keepN.add(e.target);
      }
    }
    const q = (ids: Set<string>) =>
      [...ids].map((i) => `[data-id=${JSON.stringify(i)}]`).join(",");
    if (!keepN.size) return null;
    // Everything stays visible: unrelated parts are only softened, connected lines get thicker.
    return (
      <style>{`
        .${cls} .react-flow__node:not(${q(keepN)}) { opacity: 0.6; }
        .${cls} .react-flow__edge:not(${q(keepE) || "[data-none]"}) { opacity: 0.5; }
        ${keepE.size ? `.${cls} .react-flow__edge:is(${q(keepE)}) .react-flow__edge-path { stroke-width: 3.4px !important; opacity: 1 !important; }` : ""}
      `}</style>
    );
  }, [target, g, cls]);

  const tip = body ? (
    <div
      ref={tipRef}
      role="tooltip"
      className="pointer-events-none fixed left-0 top-0 z-[60] w-72 max-w-[calc(100vw-1rem)] rounded-md border border-line bg-panel p-3 text-[13px] leading-snug shadow-xl"
    >
      {body}
    </div>
  ) : null;

  const enter = (kind: "node" | "edge") => (ev: React.MouseEvent, x: Node | Edge) => {
    last.current = { x: ev.clientX, y: ev.clientY };
    setTarget({ kind, id: x.id });
  };
  const move = (ev: React.MouseEvent) => {
    last.current = { x: ev.clientX, y: ev.clientY };
    place();
  };
  const leave = () => setTarget(null);
  // Safety nets so the highlight can never get stuck: leaving the graph, touching the empty canvas, or starting to pan clears it.
  const bind = {
    className: target ? cls : undefined,
    // In this React Flow version pointer events from nodes and lines bubble up to the pane, so only react when the
    // pointer is on the empty canvas itself.
    onPaneMouseMove: (ev: React.MouseEvent) => {
      if ((ev.target as HTMLElement).classList?.contains("react-flow__pane"))
        setTarget((t) => (t ? null : t));
    },
    onMoveStart: leave,
    onNodeMouseEnter: enter("node"),
    onNodeMouseMove: move,
    onNodeMouseLeave: leave,
    onEdgeMouseEnter: enter("edge"),
    onEdgeMouseMove: move,
    onEdgeMouseLeave: leave,
  };

  return { bind, tip: <>{highlight}{tip}</> };
}
