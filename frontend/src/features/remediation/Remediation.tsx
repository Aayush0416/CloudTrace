import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { errorInfo } from "../../lib/api";
import {
  useProject,
  useRemediations,
  useResult,
  useWhatIf,
} from "../../lib/queries";
import type { GraphData, Remediation as R } from "../../lib/types";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";
import WhatIfResult from "../../components/WhatIfResult";

export default function Remediation() {
  const id = useParams().projectId!,
    nav = useNavigate();
  const project = useProject(id),
    rem = useRemediations(id),
    graph = useResult<GraphData>(id, "graph"),
    sim = useWhatIf(id);
  const [picked, setPicked] = useState<R | null>(null);
  if (rem.isLoading || project.isLoading) return <Loading />;
  if (rem.error)
    return (
      <ErrorState
        message={errorInfo(rem.error).message}
        onRetry={() => rem.refetch()}
      />
    );
  const label = (nid: string) =>
    graph.data?.data.nodes.find((n) => n.id === nid)?.label ?? nid;
  const preview = (r: R) => {
    setPicked(r);
    sim.mutate(r.change);
  };
  return (
    <div className="page">
      <PageHeader
        title="Remediation"
        sub="Single changes ranked by how many attack paths they remove. Each one is simulated on a copy of your environment."
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <DataTable
            rows={rem.data!}
            rowKey={(r) => r.label}
            initialSort={{ key: "crit", dir: -1 }}
            empty={
              <EmptyState
                title={
                  project.data?.summary
                    ? "Nothing to fix"
                    : "No scan results yet"
                }
                body={
                  project.data?.summary
                    ? "No single change removes an attack path, because none exist."
                    : "Import an environment and run a scan from the Overview page."
                }
                action={
                  !project.data?.summary ? (
                    <Button
                      variant="primary"
                      onClick={() => nav(`/p/${id}/overview`)}
                    >
                      Go to Overview
                    </Button>
                  ) : undefined
                }
              />
            }
            cols={[
              {
                key: "a",
                header: "Change",
                cell: (r) => <span className="font-medium">{r.label}</span>,
              },
              {
                key: "crit",
                header: "Critical paths removed",
                sort: (r) => r.criticalPathsRemoved,
                cell: (r) => (
                  <span className="tabular-nums">{r.criticalPathsRemoved}</span>
                ),
              },
              {
                key: "p",
                header: "Paths removed",
                sort: (r) => r.pathsRemoved,
                cell: (r) => (
                  <span className="tabular-nums">{r.pathsRemoved}</span>
                ),
              },
              {
                key: "rr",
                header: "Risk reduced",
                sort: (r) => r.riskReduction,
                cell: (r) => (
                  <span className="tabular-nums">{r.riskReduction}</span>
                ),
              },
              {
                key: "go",
                header: "",
                cell: (r) => (
                  <Button
                    onClick={() => preview(r)}
                    busy={sim.isPending && picked === r}
                  >
                    Preview impact
                  </Button>
                ),
              },
            ]}
          />
        </Card>
        <div>
          {sim.isError && (
            <div role="alert" className="mb-2 text-crit">
              {errorInfo(sim.error).message}
            </div>
          )}
          {sim.data && picked ? (
            <WhatIfResult data={sim.data} label={label} />
          ) : (
            rem.data!.length > 0 && (
              <p className="text-muted">
                Choose a change to see the before and after comparison.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
