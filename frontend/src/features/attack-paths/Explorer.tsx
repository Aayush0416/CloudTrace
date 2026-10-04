import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftRight,
  Download,
  Maximize2,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import { errorInfo } from "../../lib/api";
import { download } from "../../lib/download";
import { useResult } from "../../lib/queries";
import type { Dir } from "../../lib/graphLayout";
import type {
  AttackPath,
  ChokePoint,
  Finding,
  GraphData,
  ResourceRow,
  Severity,
} from "../../lib/types";
import {
  EmptyState,
  ErrorState,
  Loading,
  SEV,
  SeverityBadge,
} from "../../components/ui";
import { SidePanel, usePersisted } from "../../components/SidePanel";
import {
  buildFlow,
  EDGE_STYLE,
  nodeTypes,
  visibleGraph,
  type NData,
} from "./graphKit";
import PathPanel from "./PathPanel";

const mapColor = (n: Node) => {
  const d = n.data as NData;
  return d.dim ? "#22304f" : d.ring;
};
type Mode = "all" | "critical";
interface CanvasProps {
  projectId: string;
  g: GraphData;
  resources: ResourceRow[];
  all: AttackPath[];
  filtered: AttackPath[];
  selected: AttackPath | null;
  hood: string | null;
  scope: string;
  choke: Map<string, number>;
  dir: Dir;
  setDir: (d: Dir) => void;
  onFocus: (f: { kind: "node" | "edge"; id: string } | null) => void;
  onReset: () => void;
  onImmersive: () => void;
  onExport: () => void;
}

function Canvas({
  projectId,
  g,
  resources,
  all,
  filtered,
  selected,
  hood,
  scope,
  choke,
  dir,
  setDir,
  onFocus,
  onReset,
  onImmersive,
  onExport,
}: CanvasProps) {
  const { fitView } = useReactFlow();
  const [showAll, setShowAll] = useState(true),
    [find, setFind] = useState(""),
    [mode, setMode] = usePersisted<Mode>("ct_graph_mode", "all");
  const { nodes, edges } = useMemo(
    () =>
      buildFlow({
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
      }),
    [
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
    ],
  );
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.22, duration: 250 }), 40);
    return () => clearTimeout(t);
  }, [dir, showAll, fitView]);
  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(
      () =>
        fitView({
          nodes: selected.nodes.map((id) => ({ id })),
          padding: 0.35,
          duration: 300,
        }),
      50,
    );
    return () => clearTimeout(t);
  }, [selected?.id, fitView]); // eslint-disable-line
  const doFind = () => {
    const t = find.trim().toLowerCase();
    if (!t) return;
    const n =
      g.nodes.find((x) => x.label.toLowerCase() === t) ??
      g.nodes.find((x) => x.label.toLowerCase().includes(t));
    if (n) {
      onFocus({ kind: "node", id: n.id });
      fitView({ nodes: [{ id: n.id }], maxZoom: 1.2, duration: 300 });
    }
  };
  const seg = (active: boolean) =>
    `flex h-7 items-center gap-1 whitespace-nowrap rounded px-2 text-xs ${active ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`;
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.22 }}
      minZoom={0.1}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      onNodeClick={(_, n) => onFocus({ kind: "node", id: n.id })}
      onEdgeClick={(_, e) => onFocus({ kind: "edge", id: e.id })}
      onPaneClick={() => onFocus(null)}
    >
      <Background color="#10182b" gap={26} />
      <Controls showInteractive={false} position="top-right" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        ariaLabel="Graph minimap"
        nodeColor={mapColor}
        nodeStrokeColor={mapColor}
        nodeStrokeWidth={4}
        nodeBorderRadius={20}
        maskColor="rgba(0,0,0,0.72)"
        maskStrokeColor="#fca311"
        maskStrokeWidth={1}
        style={{
          width: 200,
          height: 130,
          background: "#0a0f1c",
          border: "1px solid #22304f",
          borderRadius: 6,
        }}
      />
      <Panel position="top-left" className="!max-w-[calc(100%-72px)]">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-panel p-1">
          <div
            role="group"
            aria-label="Branch view"
            className="flex rounded bg-bg p-0.5"
          >
            <button
              className={seg(mode === "all")}
              aria-pressed={mode === "all"}
              onClick={() => setMode("all")}
            >
              All branches
            </button>
            <button
              className={seg(mode === "critical")}
              aria-pressed={mode === "critical"}
              onClick={() => setMode("critical")}
            >
              Critical and high
            </button>
          </div>
          <span className="mx-1 h-4 w-px bg-line" />
          <button
            className={seg(dir === "LR")}
            aria-pressed={dir === "LR"}
            onClick={() => setDir("LR")}
          >
            <ArrowLeftRight size={13} />
            Horizontal
          </button>
          <button
            className={seg(dir === "TB")}
            aria-pressed={dir === "TB"}
            onClick={() => setDir("TB")}
          >
            <ArrowDownUp size={13} />
            Vertical
          </button>
          <span className="mx-1 h-4 w-px bg-line" />
          <label className="flex h-7 items-center gap-1.5 px-1 text-xs text-muted">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Off-path resources
          </label>
          <span className="mx-1 h-4 w-px bg-line" />
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-2 text-muted"
            />
            <input
              list="node-names"
              aria-label="Find a resource"
              placeholder="Find resource"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doFind()}
              className="h-7 w-32 rounded border border-line bg-bg pl-7 pr-2 text-xs focus:border-accent focus:outline-none"
            />
            <datalist id="node-names">
              {g.nodes.map((n) => (
                <option key={n.id} value={n.label} />
              ))}
            </datalist>
          </div>
          <span className="mx-1 h-4 w-px bg-line" />
          <button
            className={seg(false)}
            title="Clear selection and fit the graph"
            onClick={() => {
              onReset();
              setTimeout(() => fitView({ padding: 0.22, duration: 250 }), 40);
            }}
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            className={seg(false)}
            title="Hide or show both side panels"
            onClick={onImmersive}
          >
            <Maximize2 size={13} />
            Focus
          </button>
          <button
            className={seg(false)}
            title="Download the graph and paths as JSON"
            onClick={onExport}
          >
            <Download size={13} />
            Export
          </button>
          <Link
            to={`/p/${projectId}/remediation`}
            className="flex h-7 items-center rounded bg-accent px-3 text-xs font-semibold text-bg hover:bg-accent-2"
          >
            Remediate
          </Link>
        </div>
      </Panel>
      <Panel position="bottom-left">
        <div className="space-y-1 rounded-md border border-line bg-panel/90 px-3 py-2.5 text-xs text-muted">
          {(["reaches", "connects_to", "can_access", "uses"] as const).map(
            (k) => (
              <div key={k} className="flex items-center gap-2.5">
                <svg width="26" height="6" aria-hidden>
                  <line
                    x1="1"
                    y1="3"
                    x2="25"
                    y2="3"
                    stroke={EDGE_STYLE[k].color}
                    strokeWidth="2"
                    strokeDasharray={EDGE_STYLE[k].dash}
                    strokeLinecap="round"
                  />
                </svg>
                {EDGE_STYLE[k].label}
              </div>
            ),
          )}
          <div className="flex items-center gap-2.5">
            <span className="flex w-[26px] justify-center text-accent">
              <Star size={12} fill="currentColor" />
            </span>
            Sensitive resource
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex w-[26px] justify-center text-crit">
              <AlertTriangle size={12} fill="currentColor" />
            </span>
            Internet exposure
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex w-[26px] justify-center">
              <span className="rounded bg-accent px-1 text-[10px] font-semibold text-bg">
                ×N
              </span>
            </span>
            Many paths pass here
          </div>
          <div className="border-t border-line pt-1.5">
            Ring colour = highest risk. Thicker line = critical or high.
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export default function Explorer() {
  const id = useParams().projectId!;
  const [params, setParams] = useSearchParams();
  const graph = useResult<GraphData>(id, "graph"),
    paths = useResult<AttackPath[]>(id, "attack-paths"),
    chokes = useResult<ChokePoint[]>(id, "choke-points");
  const resources = useResult<ResourceRow[]>(id, "resources"),
    findings = useResult<Finding[]>(id, "findings");
  const [sevs, setSevs] = useState<Severity[]>([]),
    [target, setTarget] = useState(""),
    [maxLen, setMaxLen] = useState(0),
    [scope, setScope] = useState("");
  const [dir, setDir] = usePersisted<Dir>("ct_graph_dir", "LR"),
    [left, setLeft] = usePersisted("ct_left_collapsed", false),
    [right, setRight] = usePersisted("ct_right_collapsed", false);
  const [focus, setFocus] = useState<{
      kind: "node" | "edge";
      id: string;
    } | null>(null),
    [hood, setHood] = useState<string | null>(null);

  const all = useMemo(() => paths.data?.data ?? [], [paths.data]),
    g = graph.data?.data,
    res = useMemo(() => resources.data?.data ?? [], [resources.data]);
  const vis = useMemo(() => (g ? visibleGraph(g) : null), [g]);
  const label = (nid: string) =>
    g?.nodes.find((n) => n.id === nid)?.label ?? nid;
  const chokeMap = useMemo(
    () => new Map((chokes.data?.data ?? []).map((c) => [c.id, c.paths])),
    [chokes.data],
  );
  const filtered = useMemo(
    () =>
      all.filter(
        (p) =>
          (!sevs.length || sevs.includes(p.risk.severity)) &&
          (!target || p.target === target) &&
          (!maxLen || p.edges.length <= maxLen),
      ),
    [all, sevs, target, maxLen],
  );
  const selected = filtered.find((p) => p.id === params.get("path")) ?? null;
  const err = graph.error ?? paths.error;
  if (graph.isLoading || paths.isLoading)
    return <Loading label="Loading graph" />;
  if (err)
    return (
      <ErrorState
        message={errorInfo(err).message}
        onRetry={() => {
          graph.refetch();
          paths.refetch();
        }}
      />
    );
  if (!graph.data!.scanId || !vis)
    return (
      <EmptyState
        title="No scan results yet"
        body="Import an environment and run a scan from the Overview page to build the graph."
      />
    );

  const select = (pid: string | null) => {
    setFocus(null);
    setHood(null);
    setParams(pid ? { path: pid } : {}, { replace: true });
  };
  const node =
      focus?.kind === "node" ? res.find((r) => r.id === focus.id) : null,
    edge =
      focus?.kind === "edge" ? vis.edges.find((e) => e.id === focus.id) : null;
  const toggle = (s: Severity) =>
    setSevs((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));
  const targets = [...new Set(all.map((p) => p.target))],
    networks = g!.nodes.filter(
      (n) => n.subtype === "vpc" || n.subtype === "subnet",
    ),
    immersive = left && right;
  const count = (s: Severity) =>
    all.filter((p) => p.risk.severity === s).length;

  return (
    <div className="flex h-full">
      <SidePanel
        side="left"
        id="explorer-left"
        title="Paths and filters"
        defaultWidth={300}
        min={230}
        max={460}
        collapsed={left}
        onToggle={() => setLeft((v) => !v)}
      >
        <div className="space-y-3 border-b border-line p-3">
          <div className="flex flex-wrap gap-1.5">
            {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
              <button
                key={s}
                aria-pressed={sevs.includes(s)}
                onClick={() => toggle(s)}
                className={`h-7 rounded border px-2.5 text-xs ${sevs.includes(s) ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`}
              >
                {SEV[s].label} <span className="tabular-nums">{count(s)}</span>
              </button>
            ))}
          </div>
          <select
            aria-label="Target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-8 w-full rounded border border-line bg-bg px-2"
          >
            <option value="">All targets</option>
            {targets.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
          <select
            aria-label="Path length"
            value={maxLen}
            onChange={(e) => setMaxLen(+e.target.value)}
            className="h-8 w-full rounded border border-line bg-bg px-2"
          >
            <option value={0}>Any path length</option>
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                Up to {n} steps
              </option>
            ))}
          </select>
          {networks.length > 0 && (
            <select
              aria-label="Network scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setHood(null);
              }}
              className="h-8 w-full rounded border border-line bg-bg px-2"
            >
              <option value="">Whole environment</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.subtype === "vpc" ? "VPC" : "Subnet"}: {n.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {(chokes.data?.data.length ?? 0) > 0 && (
          <div className="border-b border-line p-3">
            <div className="mb-1 font-semibold">Choke points</div>
            <p className="mb-2 text-xs text-muted">
              Fixing one of these breaks every path through it.
            </p>
            <ul className="space-y-0.5">
              {chokes.data!.data.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setFocus({ kind: "node", id: c.id });
                      setHood(c.id);
                      setParams({}, { replace: true });
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-raised"
                  >
                    <span className="truncate">{label(c.id)}</span>
                    <span className="text-xs text-accent">
                      {c.paths} paths · {Math.round(c.share * 100)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="px-3 py-2 font-semibold">
          Attack paths{" "}
          <span className="font-normal text-muted">({filtered.length})</span>
        </div>
        <ul>
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-muted">
              {all.length
                ? "No paths match these filters."
                : "No attack paths found in this environment."}
            </li>
          ) : (
            [...filtered]
              .sort((a, b) => b.risk.score - a.risk.score)
              .map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => select(selected?.id === p.id ? null : p.id)}
                    className={`w-full border-t border-line/60 px-3 py-2.5 text-left hover:bg-raised ${selected?.id === p.id ? "bg-raised" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[13px] font-medium">
                        {p.id}
                      </span>
                      <SeverityBadge s={p.risk.severity} />
                    </div>
                    <div className="mt-0.5 truncate text-muted">
                      {p.nodes.map(label).join(" → ")}
                    </div>
                    <div className="text-xs text-muted">
                      Score {p.risk.score} · {p.edges.length} steps
                      {p.costRank === 1 ? " · most likely route" : ""}
                    </div>
                  </button>
                </li>
              ))
          )}
        </ul>
        {paths.data?.truncated && (
          <p className="border-t border-line p-3 text-xs text-med">
            This environment has more paths than are shown. The list is capped
            at the first 500.
          </p>
        )}
      </SidePanel>

      <div className="min-w-0 flex-1" aria-label="Attack graph">
        <ReactFlowProvider>
          <Canvas
            key={graph.data!.scanId}
            projectId={id}
            g={vis}
            resources={res}
            all={all}
            filtered={filtered}
            selected={selected}
            hood={hood}
            scope={scope}
            choke={chokeMap}
            dir={dir}
            setDir={setDir}
            onFocus={(f) => {
              setFocus(f);
              if (!f) setHood(null);
            }}
            onReset={() => {
              select(null);
              setScope("");
            }}
            onImmersive={() => {
              setLeft(!immersive);
              setRight(!immersive);
            }}
            onExport={() =>
              download(
                "cloudtrace-graph.json",
                "application/json",
                JSON.stringify({ graph: vis, paths: filtered }, null, 2),
              )
            }
          />
        </ReactFlowProvider>
      </div>

      <SidePanel
        side="right"
        id="explorer-right"
        title="Details"
        defaultWidth={392}
        min={300}
        max={640}
        collapsed={right}
        onToggle={() => setRight((v) => !v)}
      >
        {focus && (
          <div className="border-b border-line p-3">
            <div className="mb-2 flex items-center justify-between font-semibold">
              {edge ? "Relationship" : "Resource"}
              <button
                aria-label="Close details"
                onClick={() => {
                  setFocus(null);
                  setHood(null);
                }}
                className="text-muted hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>
            {edge && (
              <dl className="space-y-2">
                <div>
                  <dt className="text-muted">Connection</dt>
                  <dd>
                    {label(edge.source)} → {label(edge.target)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Type</dt>
                  <dd>
                    {edge.relationship.replace("_", " ")}
                    {edge.action ? ` (${edge.action})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Confidence</dt>
                  <dd>{Math.round(edge.confidence * 100)}%</dd>
                </div>
                <div>
                  <dt className="text-muted">Evidence</dt>
                  <dd className="flex flex-wrap gap-1">
                    {edge.evidence.map((x) => (
                      <span
                        key={x}
                        className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs"
                      >
                        {x}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            )}
            {focus.kind === "node" &&
              (node ? (
                <div className="space-y-3">
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-muted">Name</dt>
                      <dd className="font-medium">{node.name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Type</dt>
                      <dd>
                        {node.type} / {node.subtype}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Exposure</dt>
                      <dd>{node.public ? "Public" : "Private"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Criticality</dt>
                      <dd>{node.criticality}</dd>
                    </div>
                    {(node.subnet || node.vpc) && (
                      <div>
                        <dt className="text-muted">Network</dt>
                        <dd>
                          {[node.vpc, node.subnet]
                            .filter((x): x is string => !!x)
                            .map(label)
                            .join(" / ")}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted">
                        Attack paths through this resource
                      </dt>
                      <dd>{node.pathCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Findings</dt>
                      <dd>
                        {(findings.data?.data ?? [])
                          .filter((f) => f.resourceId === node.id)
                          .map((f) => (
                            <div
                              key={f.ruleId}
                              className="mt-1 flex items-center gap-2"
                            >
                              <SeverityBadge s={f.severity} />
                              {f.title}
                            </div>
                          ))}
                        {!node.findingCount && "None"}
                      </dd>
                    </div>
                  </dl>
                  <button
                    onClick={() =>
                      setHood((h) => (h === node.id ? null : node.id))
                    }
                    className="h-8 rounded border border-line bg-raised px-3 hover:bg-navy-700/40"
                  >
                    {hood === node.id
                      ? "Clear neighborhood focus"
                      : "Focus neighborhood"}
                  </button>
                </div>
              ) : (
                <p className="text-muted">
                  The Internet is the entry point for every publicly exposed
                  resource.
                </p>
              ))}
          </div>
        )}
        {selected ? (
          <PathPanel
            key={selected.id}
            path={selected}
            projectId={id}
            label={label}
          />
        ) : (
          !focus && (
            <div className="p-4 text-muted">
              {filtered.length
                ? "Every branch is drawn. Select an attack path to trace its route, read the ordered steps, ask the assistant to explain it, or simulate a fix. Click a resource or relationship for details, or pick a choke point."
                : ""}
            </div>
          )
        )}
      </SidePanel>
    </div>
  );
}
