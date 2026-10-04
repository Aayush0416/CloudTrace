import { lazy, Suspense, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowRight, Check, Play, Plus } from "lucide-react";
import { errorInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useActivity } from "../../lib/activity";
import { ago } from "../../lib/format";
import {
  useAuthConfig,
  useFindingStates,
  useProjects,
  useResult,
  useRunScan,
  useScans,
} from "../../lib/queries";
import {
  SEV_ORDER,
  type AttackPath,
  type ChokePoint,
  type Finding,
  type GraphData,
  type ResourceRow,
  type Severity,
  type Summary,
} from "../../lib/types";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Kpi,
  Loading,
  ModeBadge,
  SEV,
  SeverityBadge,
} from "../../components/ui";
import { buildFlow, nodeTypes, visibleGraph } from "../attack-paths/graphKit";

const Graph3D = lazy(() => import("../../components/Graph3D"));
const PROMPTS = [
  "Summarize this scan",
  "What should I fix first?",
  "What is exposed to the internet?",
];
const DOT = { crit: "bg-crit", high: "bg-high", ok: "bg-ok", info: "bg-low" };
const NET = ["vpc", "subnet", "security_group"];

export default function Home() {
  const { user } = useAuth(),
    nav = useNavigate(),
    projects = useProjects(),
    cfg = useAuthConfig();
  const list = projects.data ?? [],
    stored = localStorage.getItem("ct_project");
  const scanned = list
    .filter((p) => p.summary)
    .sort((a, b) => (b.lastScanAt ?? "").localeCompare(a.lastScanAt ?? ""));
  const active =
      list.find((p) => p.id === stored && p.summary) ??
      scanned[0] ??
      list.find((p) => p.id === stored) ??
      list[0],
    id = active?.id ?? "";
  const scans = useScans(id),
    paths = useResult<AttackPath[]>(id, "attack-paths"),
    findings = useResult<Finding[]>(id, "findings"),
    resources = useResult<ResourceRow[]>(id, "resources");
  const graph = useResult<GraphData>(id, "graph"),
    choke = useResult<ChokePoint[]>(id, "choke-points"),
    states = useFindingStates(id),
    scan = useRunScan(id),
    activity = useActivity(id);
  const flow = useMemo(() => {
    const g = graph.data?.data,
      P = paths.data?.data ?? [];
    if (!g || !P.length) return null;
    const top = [...P].sort((a, b) => b.risk.score - a.risk.score).slice(0, 4);
    return buildFlow({
      g: visibleGraph(g),
      resources: resources.data?.data ?? [],
      all: top,
      filtered: top,
      selected: null,
      hood: null,
      scope: "",
      choke: new Map(),
      dir: "LR",
      showAll: false,
      mode: "all",
      keep: new Set(top.flatMap((p) => p.nodes)),
    });
  }, [graph.data, paths.data, resources.data]);
  if (projects.isLoading) return <Loading />;
  if (projects.error)
    return (
      <ErrorState
        message={errorInfo(projects.error).message}
        onRetry={() => projects.refetch()}
      />
    );

  const S = active?.summary ?? null,
    P = paths.data?.data ?? [],
    F = findings.data?.data ?? [],
    R = resources.data?.data ?? [],
    first = user?.name.split(" ")[0] ?? "";
  const hist = scans.data ?? [],
    last = hist[hist.length - 1]?.summary,
    prev = hist[hist.length - 2]?.summary;
  const delta = (k: keyof Summary) =>
    hist.length >= 2 && last && prev ? last[k] - prev[k] : null;
  const statusOf = (f: Finding) =>
    states.data?.find(
      (x) => x.ruleId === f.ruleId && x.resourceId === f.resourceId,
    )?.status ?? "open";
  const openN = F.filter(
      (f) => statusOf(f) === "open" || statusOf(f) === "acknowledged",
    ).length,
    highN = F.filter(
      (f) => f.severity === "critical" || f.severity === "high",
    ).length;
  const dist = (["critical", "high", "medium", "low", "info"] as Severity[])
      .map((k) => ({
        k,
        label: SEV[k].label,
        n: F.filter((f) => f.severity === k).length,
      }))
      .filter((d) => d.n > 0),
    total = F.length;
  const nm = (rid: string) =>
    R.find((r) => r.id === rid)?.name ??
    (rid === "internet" ? "Internet" : rid);
  const top = [...P].sort((a, b) => b.risk.score - a.risk.score);
  const maxSev = new Map<string, Severity>();
  for (const p of P)
    for (const n of p.nodes.slice(1))
      if (
        !maxSev.has(n) ||
        SEV_ORDER[p.risk.severity] > SEV_ORDER[maxSev.get(n)!]
      )
        maxSev.set(n, p.risk.severity);
  const risky = R.filter((r) => !NET.includes(r.subtype))
    .map((r) => ({ r, sev: maxSev.get(r.id) }))
    .sort(
      (a, b) =>
        (b.sev ? SEV_ORDER[b.sev] : -1) - (a.sev ? SEV_ORDER[a.sev] : -1) ||
        b.r.pathCount - a.r.pathCount,
    )
    .slice(0, 5);
  const steps = [
    {
      t: "Create a project",
      d: "A project holds one cloud environment.",
      done: list.length > 0,
      cta: "Create project",
      go: () => nav("/projects?new=1"),
    },
    {
      t: "Import an environment",
      d: "Upload JSON, or start from the enterprise sample.",
      done: list.some((p) => p.environmentName),
      cta: "Import",
      go: () => active && nav(`/p/${active.id}/overview`),
    },
    {
      t: "Run your first scan",
      d: "Generates findings, attack paths and the graph.",
      done: list.some((p) => p.summary),
      cta: "Open project",
      go: () => active && nav(`/p/${active.id}/overview`),
    },
  ];
  const doneN = steps.filter((s) => s.done).length,
    next = steps.find((s) => !s.done);
  const sentence = !active
    ? "Create a project and import a cloud environment to see how exposure connects to your sensitive assets."
    : !S
      ? `${active.name} has no scan yet. Import an environment and run a scan to build its graph.`
      : `${S.criticalPaths} critical of ${S.paths} attack paths across ${S.resources} resources in ${active.name}. Last scan ${ago(active.lastScanAt)}.`;

  const setup = (
    <Card
      title="Setup"
      actions={
        <span className="text-xs text-muted">
          {doneN} of {steps.length} complete
        </span>
      }
    >
      <div className="p-4">
        <div className="h-1.5 overflow-hidden rounded bg-raised">
          <div
            className="h-full rounded bg-accent transition-all"
            style={{ width: `${(doneN / steps.length) * 100}%` }}
          />
        </div>
        <ol className="mt-4 space-y-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${s.done ? "bg-ok text-black" : s === next ? "border border-accent text-accent" : "border border-line text-muted"}`}
              >
                {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.t}</div>
                <div className="text-muted">{s.d}</div>
                {s === next && (
                  <Button variant="primary" className="mt-2" onClick={s.go}>
                    {s.cta}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );

  return (
    <div className="page space-y-5">
      <section className="overflow-hidden rounded-md border border-line bg-panel">
        <div className="grid items-center lg:grid-cols-[1.5fr_1fr]">
          <div className="p-6 lg:p-8">
            <h1 className="text-2xl font-semibold">Welcome back, {first}</h1>
            <p className="mt-1.5 max-w-xl text-muted">{sentence}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {!active ? (
                <Button
                  variant="primary"
                  onClick={() => nav("/projects?new=1")}
                >
                  <Plus size={14} />
                  New project
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    busy={scan.isPending}
                    disabled={!active.environmentName}
                    onClick={() => scan.mutate()}
                  >
                    <Play size={14} />
                    Run new scan
                  </Button>
                  <Button
                    onClick={() => nav(`/p/${active.id}/attack-paths`)}
                    disabled={!S}
                  >
                    View attack paths
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => nav(`/p/${active.id}/overview`)}
                  >
                    Project overview
                  </Button>
                </>
              )}
            </div>
            {scan.isError && (
              <p role="alert" className="mt-3 text-crit">
                {errorInfo(scan.error).message}
              </p>
            )}
          </div>
          <Suspense fallback={<div className="h-48" />}>
            <Graph3D
              variant="banner"
              className="h-48 w-full border-l border-line/60 bg-[radial-gradient(ellipse_at_center,var(--color-navy-800)_0%,transparent_75%)]"
            />
          </Suspense>
        </div>
      </section>

      {!S ? (
        setup
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi
              label="Resources"
              value={S.resources}
              delta={delta("resources")}
              goodWhen="none"
            />
            <Kpi label="Attack paths" value={S.paths} delta={delta("paths")} />
            <Kpi
              label="Critical paths"
              value={S.criticalPaths}
              tone={S.criticalPaths ? "text-crit" : ""}
              delta={delta("criticalPaths")}
            />
            <Kpi
              label="High-severity findings"
              value={highN}
              tone={highN ? "text-high" : ""}
            />
            <Kpi label="Open findings" value={openN} />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Card
                title="Attack path overview"
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => nav(`/p/${id}/attack-paths`)}
                  >
                    View full graph
                    <ArrowRight size={14} />
                  </Button>
                }
              >
                <div className="h-[340px]">
                  {flow ? (
                    <ReactFlow
                      nodes={flow.nodes}
                      edges={flow.edges}
                      nodeTypes={nodeTypes}
                      colorMode="dark"
                      fitView
                      fitViewOptions={{ padding: 0.28 }}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      zoomOnScroll={false}
                      zoomOnPinch={false}
                      zoomOnDoubleClick={false}
                      panOnDrag={false}
                      preventScrolling={false}
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background color="#10182b" gap={26} />
                    </ReactFlow>
                  ) : (
                    <EmptyState
                      title="No attack paths"
                      body="No exposed entry point can reach a sensitive asset in the latest scan."
                    />
                  )}
                </div>
                <p className="border-t border-line px-4 py-2 text-xs text-muted">
                  The four highest-risk paths. Ring colour shows risk level and
                  heavier lines are critical.
                </p>
              </Card>
            </div>
            <div className="lg:col-span-3">
              <Card title="Risk distribution" className="h-full">
                {total ? (
                  <div className="p-4">
                    <div className="relative mx-auto h-44 w-44">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={dist}
                            dataKey="n"
                            innerRadius={58}
                            outerRadius={80}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {dist.map((d) => (
                              <Cell key={d.k} fill={SEV[d.k].hex} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-semibold text-white">
                          {total}
                        </div>
                        <div className="text-xs text-muted">findings</div>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-1.5">
                      {dist.map((d) => (
                        <li
                          key={d.k}
                          className="flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: SEV[d.k].hex }}
                            />
                            {d.label}
                          </span>
                          <span className="tabular-nums text-muted">
                            {d.n} · {Math.round((d.n / total) * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState
                    title="No findings"
                    body="No security rules matched."
                  />
                )}
              </Card>
            </div>
            <div className="lg:col-span-3">
              <Card title="Recent activity" className="h-full">
                {activity.length ? (
                  <ul className="px-4 py-2">
                    {activity.slice(0, 6).map((a) => (
                      <li
                        key={a.key}
                        className="flex gap-3 border-b border-line/60 py-2.5 last:border-0"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[a.tone]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-medium">
                              {a.title}
                            </span>
                            <span className="shrink-0 text-xs text-muted">
                              {ago(a.at)}
                            </span>
                          </div>
                          <div className="truncate text-xs text-muted">
                            {a.sub}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No activity yet"
                    body="Scans and finding updates will show up here."
                  />
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Card
                title="Top risk resources"
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => nav(`/p/${id}/resources`)}
                  >
                    All resources
                    <ArrowRight size={14} />
                  </Button>
                }
              >
                <DataTable
                  rows={risky}
                  rowKey={(x) => x.r.id}
                  onRowClick={() => nav(`/p/${id}/attack-paths`)}
                  empty={
                    <EmptyState
                      title="No resources"
                      body="Run a scan to list resources."
                    />
                  }
                  cols={[
                    {
                      key: "n",
                      header: "Resource",
                      cell: (x) => (
                        <div>
                          <div className="font-medium">{x.r.name}</div>
                          <div className="text-xs text-muted">
                            {x.r.subtype.replace("_", " ")}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "l",
                      header: "Risk level",
                      cell: (x) =>
                        x.sev ? (
                          <SeverityBadge s={x.sev} />
                        ) : (
                          <span className="text-muted">None</span>
                        ),
                    },
                    {
                      key: "p",
                      header: "Paths",
                      cell: (x) => (
                        <span className="tabular-nums">{x.r.pathCount}</span>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
            <div className="lg:col-span-4">
              <Card
                title="Highest-risk paths"
                className="h-full"
                actions={
                  <Button
                    variant="ghost"
                    onClick={() => nav(`/p/${id}/attack-paths`)}
                  >
                    Open graph
                    <ArrowRight size={14} />
                  </Button>
                }
              >
                {top.length ? (
                  <ul>
                    {top.slice(0, 4).map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() =>
                            nav(`/p/${id}/attack-paths?path=${p.id}`)
                          }
                          className="w-full border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-raised"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[13px] font-medium">
                              {p.id}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums text-muted">
                                {p.risk.score}
                              </span>
                              <SeverityBadge s={p.risk.severity} />
                            </span>
                          </div>
                          <div className="mt-1 truncate text-muted">
                            {p.nodes.map(nm).join(" → ")}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No attack paths"
                    body="Nothing reaches a sensitive asset."
                  />
                )}
                {(choke.data?.data.length ?? 0) > 0 && (
                  <div className="border-t border-line px-4 py-3 text-xs text-muted">
                    Choke point:{" "}
                    <span className="text-fg">
                      {nm(choke.data!.data[0].id)}
                    </span>{" "}
                    sits on {choke.data!.data[0].paths} paths.
                  </div>
                )}
              </Card>
            </div>
            <div className="space-y-5 lg:col-span-3">
              <Card
                title="Security advisor"
                actions={
                  <ModeBadge mode={cfg.data?.ai === "llm" ? "llm" : "demo"} />
                }
              >
                <div className="p-4">
                  <p className="text-muted">
                    Ask for a plain-language explanation of any path, or what to
                    fix first.
                  </p>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {PROMPTS.map((q) => (
                      <Link
                        key={q}
                        to={`/p/${id}/assistant?q=${encodeURIComponent(q)}`}
                        className="flex h-8 items-center justify-between rounded border border-line px-3 hover:border-accent hover:bg-raised"
                      >
                        {q}
                        <ArrowRight size={13} className="text-muted" />
                      </Link>
                    ))}
                  </div>
                </div>
              </Card>
              {doneN < steps.length && setup}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
