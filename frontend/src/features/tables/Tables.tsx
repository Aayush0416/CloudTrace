import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { errorInfo } from "../../lib/api";
import {
  useFindingStates,
  useResult,
  useSetFindingState,
} from "../../lib/queries";
import type {
  Finding,
  FindingStatus,
  ResourceRow,
  Severity,
} from "../../lib/types";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  inputCls,
  Loading,
  Modal,
  PageHeader,
  SEV,
  SeverityBadge,
  sevSort,
} from "../../components/ui";

const STATUS: Record<FindingStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  fixed: "Fixed",
  accepted: "Risk accepted",
};

export function FindingsPage() {
  const id = useParams().projectId!,
    [params] = useSearchParams();
  const f = useResult<Finding[]>(id, "findings"),
    r = useResult<ResourceRow[]>(id, "resources"),
    states = useFindingStates(id),
    set = useSetFindingState(id);
  const [sev, setSev] = useState(""),
    [st, setSt] = useState(""),
    [q, setQ] = useState(params.get("q") ?? ""),
    [accepting, setAccepting] = useState<Finding | null>(null),
    [note, setNote] = useState("");
  if (f.isLoading) return <Loading />;
  if (f.error)
    return (
      <ErrorState
        message={errorInfo(f.error).message}
        onRetry={() => f.refetch()}
      />
    );
  const name = (rid: string) =>
    r.data?.data.find((x) => x.id === rid)?.name ?? rid;
  const stateOf = (x: Finding) =>
    states.data?.find(
      (s) => s.ruleId === x.ruleId && s.resourceId === x.resourceId,
    );
  const status = (x: Finding): FindingStatus => stateOf(x)?.status ?? "open";
  const rows = f.data!.data.filter(
    (x) =>
      (!sev || x.severity === sev) &&
      (!st || status(x) === st) &&
      `${x.title} ${x.ruleId} ${name(x.resourceId)}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const change = (x: Finding, s: FindingStatus) =>
    s === "accepted"
      ? (setNote(stateOf(x)?.note ?? ""), setAccepting(x))
      : set.mutate({ ruleId: x.ruleId, resourceId: x.resourceId, status: s });
  const open = f.data!.data.filter((x) => status(x) === "open").length;
  return (
    <div className="page">
      <PageHeader
        title="Findings"
        sub={`${f.data!.data.length} from the latest scan · ${open} open`}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Search findings"
          aria-label="Search findings"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Severity"
          className={`${inputCls} w-40`}
          value={sev}
          onChange={(e) => setSev(e.target.value)}
        >
          <option value="">All severities</option>
          {(Object.keys(SEV) as Severity[]).reverse().map((k) => (
            <option key={k} value={k}>
              {SEV[k].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={`${inputCls} w-44`}
          value={st}
          onChange={(e) => setSt(e.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {set.isError && (
        <div role="alert" className="mb-3 text-crit">
          {errorInfo(set.error).message}
        </div>
      )}
      <Card>
        <DataTable
          rows={rows}
          rowKey={(x) => x.ruleId + x.resourceId}
          initialSort={{ key: "sev", dir: -1 }}
          empty={
            <EmptyState
              title={
                f.data!.scanId ? "No matching findings" : "No scan results yet"
              }
              body={
                f.data!.scanId
                  ? "Change the filters to see more."
                  : "Import an environment and run a scan from the Overview page."
              }
            />
          }
          cols={[
            {
              key: "sev",
              header: "Severity",
              sort: (x) => sevSort(x.severity),
              cell: (x) => <SeverityBadge s={x.severity} />,
            },
            {
              key: "title",
              header: "Finding",
              sort: (x) => x.title,
              cell: (x) => (
                <div>
                  <div className="font-medium">{x.title}</div>
                  <div className="text-muted">{x.description}</div>
                  {status(x) === "accepted" && stateOf(x)?.note && (
                    <div className="mt-1 text-xs text-med">
                      Accepted: {stateOf(x)!.note}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "res",
              header: "Resource",
              sort: (x) => name(x.resourceId),
              cell: (x) => name(x.resourceId),
            },
            {
              key: "rule",
              header: "Rule",
              sort: (x) => x.ruleId,
              cell: (x) => x.ruleId,
            },
            {
              key: "st",
              header: "Status",
              sort: (x) => status(x),
              cell: (x) => (
                <select
                  aria-label={`Status of ${x.title}`}
                  value={status(x)}
                  onChange={(e) => change(x, e.target.value as FindingStatus)}
                  className="h-8 rounded border border-line bg-bg px-2"
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </Card>
      {accepting && (
        <Modal title="Accept risk" onClose={() => setAccepting(null)}>
          <div className="space-y-4">
            <p>
              Record why <span className="font-medium">{accepting.title}</span>{" "}
              on {name(accepting.resourceId)} is acceptable. The justification
              stays with the finding.
            </p>
            <Field label="Justification">
              <textarea
                className={inputCls}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAccepting(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={note.trim().length < 5}
                busy={set.isPending}
                onClick={async () => {
                  await set.mutateAsync({
                    ruleId: accepting.ruleId,
                    resourceId: accepting.resourceId,
                    status: "accepted",
                    note,
                  });
                  setAccepting(null);
                }}
              >
                Accept risk
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ResourcesPage() {
  const id = useParams().projectId!,
    [params] = useSearchParams(),
    r = useResult<ResourceRow[]>(id, "resources");
  const [type, setType] = useState(""),
    [q, setQ] = useState(params.get("q") ?? "");
  if (r.isLoading) return <Loading />;
  if (r.error)
    return (
      <ErrorState
        message={errorInfo(r.error).message}
        onRetry={() => r.refetch()}
      />
    );
  const all = r.data!.data,
    types = [...new Set(all.map((x) => x.type))].sort(),
    nm = (rid?: string) => all.find((x) => x.id === rid)?.name ?? "–";
  const rows = all.filter(
    (x) =>
      (!type || x.type === type) &&
      `${x.name} ${x.subtype}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="page">
      <PageHeader title="Resources" sub={`${all.length} in the latest scan`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="Search resources"
          aria-label="Search resources"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Type"
          className={`${inputCls} w-40`}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowKey={(x) => x.id}
          initialSort={{ key: "paths", dir: -1 }}
          empty={
            <EmptyState
              title={
                r.data!.scanId ? "No matching resources" : "No scan results yet"
              }
              body={
                r.data!.scanId
                  ? "Change the filters to see more."
                  : "Import an environment and run a scan from the Overview page."
              }
            />
          }
          cols={[
            {
              key: "n",
              header: "Resource",
              sort: (x) => x.name.toLowerCase(),
              cell: (x) => (
                <div>
                  <div className="font-medium">{x.name}</div>
                  <div className="text-muted">{x.id}</div>
                </div>
              ),
            },
            {
              key: "t",
              header: "Type",
              sort: (x) => x.subtype,
              cell: (x) => `${x.type} / ${x.subtype}`,
            },
            {
              key: "net",
              header: "Network",
              sort: (x) => nm(x.subnet),
              cell: (x) =>
                x.subnet ? (
                  `${nm(x.vpc)} / ${nm(x.subnet)}`
                ) : (
                  <span className="text-muted">–</span>
                ),
            },
            {
              key: "e",
              header: "Exposure",
              sort: (x) => +x.public,
              cell: (x) =>
                x.public ? (
                  <span className="text-high">Public</span>
                ) : (
                  <span className="text-muted">Private</span>
                ),
            },
            {
              key: "c",
              header: "Criticality",
              sort: (x) => x.criticality,
              cell: (x) => x.criticality,
            },
            {
              key: "f",
              header: "Findings",
              sort: (x) => x.findingCount,
              cell: (x) => (
                <span className="tabular-nums">{x.findingCount}</span>
              ),
            },
            {
              key: "paths",
              header: "Attack paths",
              sort: (x) => x.pathCount,
              cell: (x) => <span className="tabular-nums">{x.pathCount}</span>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
