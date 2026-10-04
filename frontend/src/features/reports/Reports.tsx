import { useParams } from "react-router-dom";
import { Download, FileJson, Printer, Table } from "lucide-react";
import { errorInfo } from "../../lib/api";
import { csv, download } from "../../lib/download";
import {
  fmtTime,
  useFindingStates,
  useProject,
  useResult,
} from "../../lib/queries";
import type {
  AttackPath,
  Finding,
  GraphData,
  ResourceRow,
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
  SeverityBadge,
} from "../../components/ui";

export default function Reports() {
  const id = useParams().projectId!,
    project = useProject(id),
    paths = useResult<AttackPath[]>(id, "attack-paths"),
    fin = useResult<Finding[]>(id, "findings");
  const res = useResult<ResourceRow[]>(id, "resources"),
    graph = useResult<GraphData>(id, "graph"),
    states = useFindingStates(id);
  if (project.isLoading || paths.isLoading || fin.isLoading) return <Loading />;
  const err = project.error ?? paths.error ?? fin.error;
  if (err) return <ErrorState message={errorInfo(err).message} />;
  if (!project.data?.summary)
    return (
      <div className="page">
        <PageHeader title="Reports" />
        <Card>
          <EmptyState
            title="No scan results yet"
            body="Run a scan from the Overview page to generate a report."
          />
        </Card>
      </div>
    );
  const p = [...paths.data!.data].sort((a, b) => b.risk.score - a.risk.score),
    f = fin.data!.data,
    s = project.data.summary;
  const label = (nid: string) =>
    graph.data?.data.nodes.find((n) => n.id === nid)?.label ?? nid;
  const status = (x: Finding) =>
    states.data?.find(
      (t) => t.ruleId === x.ruleId && t.resourceId === x.resourceId,
    )?.status ?? "open";
  const slug = project.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const pathRows = () => [
    [
      "id",
      "severity",
      "score",
      "entry",
      "target",
      "steps",
      "likelihood",
      "route",
      "attack_techniques",
    ],
    ...p.map((x) => [
      x.id,
      x.risk.severity,
      x.risk.score,
      label(x.entryPoint),
      label(x.target),
      x.edges.length,
      x.likelihood,
      x.nodes.map(label).join(" > "),
      [...new Set(x.edges.map((e) => e.mitre?.id ?? ""))].join(" "),
    ]),
  ];
  return (
    <div className="page">
      <PageHeader
        title="Reports"
        sub={`${project.data.name} · scan of ${fmtTime(project.data.lastScanAt)}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button
              onClick={() =>
                download(
                  `${slug}-report.json`,
                  "application/json",
                  JSON.stringify(
                    {
                      project: project.data!.name,
                      scannedAt: project.data!.lastScanAt,
                      summary: s,
                      paths: p,
                      findings: f,
                      resources: res.data?.data,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              <FileJson size={14} />
              JSON
            </Button>
            <Button
              onClick={() =>
                download(`${slug}-paths.csv`, "text/csv", csv(pathRows()))
              }
            >
              <Table size={14} />
              Paths CSV
            </Button>
            <Button
              onClick={() =>
                download(
                  `${slug}-findings.csv`,
                  "text/csv",
                  csv([
                    ["severity", "rule", "title", "resource", "status"],
                    ...f.map((x) => [
                      x.severity,
                      x.ruleId,
                      x.title,
                      label(x.resourceId),
                      status(x),
                    ]),
                  ]),
                )
              }
            >
              <Download size={14} />
              Findings CSV
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer size={14} />
              Print or save as PDF
            </Button>
          </div>
        }
      />
      <div className="space-y-5">
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
        <Card title="Attack paths">
          <DataTable
            rows={p}
            rowKey={(x) => x.id}
            empty={
              <EmptyState
                title="No attack paths"
                body="No exposed entry point can reach a sensitive asset."
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
                    {x.risk.score}
                  </span>
                ),
              },
              {
                key: "route",
                header: "Route",
                cell: (x) => x.nodes.map(label).join(" → "),
              },
              {
                key: "att",
                header: "ATT&CK",
                cell: (x) =>
                  [...new Set(x.edges.map((e) => e.mitre?.id))]
                    .filter(Boolean)
                    .join(", "),
              },
            ]}
          />
        </Card>
        <Card title="Findings">
          <DataTable
            rows={f}
            rowKey={(x) => x.ruleId + x.resourceId}
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
                cell: (x) => <SeverityBadge s={x.severity} />,
              },
              { key: "t", header: "Finding", cell: (x) => x.title },
              {
                key: "r",
                header: "Resource",
                cell: (x) => label(x.resourceId),
              },
              { key: "st", header: "Status", cell: (x) => status(x) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
