import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Network, Play, Upload } from "lucide-react";
import { errorInfo } from "../../lib/api";
import {
  fmtTime,
  useDiff,
  useProject,
  useResult,
  useRunScan,
  useScans,
} from "../../lib/queries";
import {
  SEV_ORDER,
  type AttackPath,
  type ChokePoint,
  type Finding,
  type ResourceRow,
  type Severity,
} from "../../lib/types";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Kpi,
  Loading,
  PageHeader,
  SEV,
  SeverityBadge,
} from "../../components/ui";
import ImportDialog from "../projects/ImportDialog";

const axis = { stroke: "var(--color-muted)", fontSize: 11 };
const tip = {
  contentStyle: {
    background: "var(--color-raised)",
    border: "1px solid var(--color-line)",
    fontSize: 12,
  },
  cursor: { fill: "color-mix(in srgb, var(--color-accent) 10%, transparent)" },
};

export default function Overview() {
  const id = useParams().projectId!,
    nav = useNavigate();
  const project = useProject(id),
    scan = useRunScan(id),
    scans = useScans(id);
  const paths = useResult<AttackPath[]>(id, "attack-paths"),
    findings = useResult<Finding[]>(id, "findings"),
    resources = useResult<ResourceRow[]>(id, "resources");
  const [importing, setImporting] = useState(false),
    diff = useDiff(id),
    choke = useResult<ChokePoint[]>(id, "choke-points");
  if (project.isLoading) return <Loading />;
  if (project.error)
    return (
      <ErrorState
        message={errorInfo(project.error).message}
        onRetry={() => project.refetch()}
      />
    );
  const p = project.data!,
    s = p.summary;
  const pathRows = [...(paths.data?.data ?? [])].sort(
    (a, b) => b.risk.score - a.risk.score,
  );
  const name = (rid: string) =>
    resources.data?.data.find((r) => r.id === rid)?.name ??
    (rid === "internet" ? "Internet" : rid);
  const sevCounts = (Object.keys(SEV) as Severity[]).map((k) => ({
    k,
    label: SEV[k].label,
    n: (findings.data?.data ?? []).filter((f) => f.severity === k).length,
  }));
  const trend = (scans.data ?? []).map((x, i) => ({
    n: `#${i + 1}`,
    paths: x.summary?.paths ?? 0,
    critical: x.summary?.criticalPaths ?? 0,
  }));
  const exposed = (resources.data?.data ?? []).filter((r) => r.public);
  const recent = [...(findings.data?.data ?? [])]
    .sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity])
    .slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        title={p.name}
        sub={
          <>
            Environment: {p.environmentName ?? "none imported"} · Last scan:{" "}
            {fmtTime(p.lastScanAt)}
          </>
        }
        actions={
          <>
            <Button onClick={() => setImporting(true)}>
              <Upload size={14} />
              Import environment
            </Button>
            <Button
              variant="primary"
              busy={scan.isPending}
              disabled={!p.hasEnvironment}
              onClick={() => scan.mutate()}
            >
              <Play size={14} />
              Run scan
            </Button>
          </>
        }
      />
      {scan.isError && (
        <div
          role="alert"
          className="mb-3 rounded border border-crit/40 bg-crit/10 px-3 py-2 text-crit"
        >
          {errorInfo(scan.error).message}
        </div>
      )}
      {!p.hasEnvironment ? (
        <Card>
          <EmptyState
            title="No environment imported"
            body="Import a cloud environment to build the security graph and find attack paths. You can start from a sample."
            action={
              <Button variant="primary" onClick={() => setImporting(true)}>
                <Upload size={14} />
                Import environment
              </Button>
            }
          />
        </Card>
      ) : !s ? (
        <Card>
          <EmptyState
            title="Environment imported, not scanned yet"
            body="Run a scan to generate findings and attack paths."
            action={
              <Button
                variant="primary"
                busy={scan.isPending}
                onClick={() => scan.mutate()}
              >
                <Play size={14} />
                Run scan
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Resources" value={s.resources} />
            <Kpi label="Findings" value={s.findings} />
            <Kpi label="Attack paths" value={s.paths} />
            <Kpi
              label="Critical paths"
              value={s.criticalPaths}
              tone={s.criticalPaths ? "text-crit" : ""}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Findings by severity">
              <div className="h-48 p-3">
                <ResponsiveContainer>
                  <BarChart data={sevCounts}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis dataKey="label" {...axis} />
                    <YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...tip} />
                    <Bar dataKey="n" name="Findings" radius={[2, 2, 0, 0]}>
                      {sevCounts.map((c) => (
                        <Cell key={c.k} fill={SEV[c.k].hex} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Trend across scans">
              {trend.length < 2 ? (
                <EmptyState
                  title="Not enough history"
                  body="Run another scan after changing the environment to see how attack paths change."
                />
              ) : (
                <div className="h-48 p-3">
                  <ResponsiveContainer>
                    <LineChart data={trend}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis dataKey="n" {...axis} />
                      <YAxis allowDecimals={false} {...axis} />
                      <Tooltip {...tip} />
                      <Line
                        dataKey="paths"
                        name="Attack paths"
                        stroke="var(--color-accent)"
                        dot
                      />
                      <Line
                        dataKey="critical"
                        name="Critical paths"
                        stroke="var(--color-crit)"
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Choke points">
              {(choke.data?.data.length ?? 0) === 0 ? (
                <EmptyState
                  title="No choke points"
                  body="No single resource sits on several attack paths."
                />
              ) : (
                <ul className="p-2">
                  {choke.data!.data.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => nav(`/p/${id}/attack-paths`)}
                        className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-raised"
                      >
                        <span className="w-28 shrink-0 truncate font-medium sm:w-36">
                          {name(c.id)}
                        </span>
                        <span className="h-1.5 flex-1 rounded bg-raised">
                          <span
                            className="block h-full rounded bg-brand"
                            style={{ width: `${c.share * 100}%` }}
                          />
                        </span>
                        <span className="w-24 shrink-0 text-right text-muted">
                          {c.paths} paths · {Math.round(c.share * 100)}%
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Changes since previous scan">
              {!diff.data ? (
                <EmptyState
                  title="No previous scan"
                  body="Run another scan after changing the environment to see which paths appeared or were resolved."
                />
              ) : (
                <div className="space-y-3 p-4">
                  <div className="text-muted">
                    {fmtTime(diff.data.previousAt)} →{" "}
                    {fmtTime(diff.data.currentAt)}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-muted">New paths</div>
                      <div
                        className={`text-xl font-semibold ${diff.data.newPaths.length ? "text-crit" : ""}`}
                      >
                        {diff.data.newPaths.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted">Resolved</div>
                      <div
                        className={`text-xl font-semibold ${diff.data.resolvedPaths.length ? "text-ok" : ""}`}
                      >
                        {diff.data.resolvedPaths.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted">Score changes</div>
                      <div className="text-xl font-semibold">
                        {diff.data.scoreChanges.length}
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {diff.data.newPaths.slice(0, 3).map((x) => (
                      <li
                        key={x.id}
                        className="flex items-center gap-2"
                      >
                        <SeverityBadge s={x.severity} />
                        <span className="truncate">
                          New: {x.nodes.map(name).join(" → ")}
                        </span>
                      </li>
                    ))}
                    {diff.data.resolvedPaths.slice(0, 3).map((x) => (
                      <li
                        key={x.id}
                        className="flex items-center gap-2 text-ok"
                      >
                        <span className="truncate">
                          Resolved: {x.nodes.map(name).join(" → ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
          <Card
            title="Critical attack paths"
            actions={
              <Button
                variant="ghost"
                onClick={() => nav(`/p/${id}/attack-paths`)}
              >
                View all
              </Button>
            }
          >
            <DataTable
              rows={pathRows.slice(0, 5)}
              rowKey={(x) => x.id}
              onRowClick={(x) => nav(`/p/${id}/attack-paths?path=${x.id}`)}
              empty={
                <EmptyState
                  title="No attack paths found"
                  body="No exposed entry point can reach a sensitive asset in this environment."
                />
              }
              cols={[
                {
                  key: "id",
                  header: "Path",
                  cell: (x) => <span className="font-medium">{x.id}</span>,
                },
                {
                  key: "sev",
                  header: "Risk",
                  cell: (x) => (
                    <span className="flex items-center gap-2">
                      <SeverityBadge s={x.risk.severity} />
                      <span className="tabular-nums">{x.risk.score}</span>
                    </span>
                  ),
                },
                {
                  key: "entry",
                  header: "Entry",
                  cell: (x) => name(x.entryPoint),
                },
                {
                  key: "target",
                  header: "Target",
                  cell: (x) => name(x.target),
                },
                {
                  key: "len",
                  header: "Length",
                  cell: (x) => `${x.edges.length} steps`,
                },
              ]}
            />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Exposed resources">
              <DataTable
                rows={exposed}
                rowKey={(r) => r.id}
                empty={
                  <EmptyState
                    title="Nothing is exposed"
                    body="No resource is reachable from the internet."
                  />
                }
                cols={[
                  { key: "n", header: "Resource", cell: (r) => r.name },
                  { key: "t", header: "Type", cell: (r) => r.subtype },
                  {
                    key: "e",
                    header: "Exposure",
                    cell: () => <span className="text-high">Public</span>,
                  },
                  {
                    key: "p",
                    header: "Paths",
                    cell: (r) => (
                      <span className="tabular-nums">{r.pathCount}</span>
                    ),
                  },
                ]}
              />
            </Card>
            <Card
              title="Recent findings"
              actions={
                <Button
                  variant="ghost"
                  onClick={() => nav(`/p/${id}/findings`)}
                >
                  View all
                </Button>
              }
            >
              <DataTable
                rows={recent}
                rowKey={(f) => f.ruleId + f.resourceId}
                empty={
                  <EmptyState
                    title="No findings"
                    body="No security rules matched."
                  />
                }
                cols={[
                  {
                    key: "s",
                    header: "Severity",
                    cell: (f) => <SeverityBadge s={f.severity} />,
                  },
                  {
                    key: "r",
                    header: "Resource",
                    cell: (f) => name(f.resourceId),
                  },
                  { key: "rule", header: "Rule", cell: (f) => f.title },
                ]}
              />
            </Card>
          </div>
          <div>
            <Button onClick={() => nav(`/p/${id}/attack-paths`)}>
              <Network size={14} />
              Explore graph
            </Button>
          </div>
        </div>
      )}
      {importing && (
        <ImportDialog projectId={id} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}
