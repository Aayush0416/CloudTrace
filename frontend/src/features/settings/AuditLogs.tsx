import { useParams } from "react-router-dom";
import {
  PageHeader,
  Card,
  DataTable,
  EmptyState,
  Loading,
} from "../../components/ui";
import { useAuditLogs } from "../../lib/queries";

const LABELS: Record<string, string> = {
  "project.create": "Project created",
  "project.update": "Project updated",
  "project.delete": "Project deleted",
  "environment.import": "Environment imported",
  "scan.run": "Scan run",
  "finding.state": "Finding status changed",
};

export default function AuditLogs() {
  const { projectId = "" } = useParams();
  const q = useAuditLogs(projectId);
  if (q.isLoading) return <Loading label="Loading audit log" />;
  const logs = q.data ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Audit Log"
        sub="Track activities and configuration changes"
      />
      <Card title="Recent Activity">
        <DataTable
          rows={logs}
          rowKey={(x) => x.id}
          empty={
            <EmptyState
              title="No audit logs"
              body="No recent activity found for this project."
            />
          }
          cols={[
            {
              key: "time",
              header: "Timestamp",
              cell: (x) => new Date(x.createdAt).toLocaleString(),
            },
            { key: "user", header: "User", cell: (x) => x.user.email },
            {
              key: "action",
              header: "Action",
              cell: (x) => LABELS[x.action] ?? x.action,
            },
            {
              key: "details",
              header: "Details",
              cell: (x) => (x.details ? JSON.stringify(x.details) : ""),
            },
          ]}
        />
      </Card>
    </div>
  );
}
