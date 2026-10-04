import { useParams } from "react-router-dom";
import { PageHeader, Card, DataTable, EmptyState } from "../../components/ui";

export default function AuditLogs() {
  const { projectId } = useParams();

  const logs: any[] = [];

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
            { key: "action", header: "Action", cell: (x) => x.action },
            {
              key: "details",
              header: "Details",
              cell: (x) => JSON.stringify(x.details),
            },
          ]}
        />
      </Card>
    </div>
  );
}
