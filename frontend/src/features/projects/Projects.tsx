import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { errorInfo } from "../../lib/api";
import {
  fmtTime,
  useCreateProject,
  useDeleteProject,
  useProjects,
} from "../../lib/queries";
import type { Project } from "../../lib/types";
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
} from "../../components/ui";

const schema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80),
  description: z.string().max(300).optional(),
});

function NewProject({ onClose }: { onClose: () => void }) {
  const create = useCreateProject(),
    nav = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <Modal title="New project" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={handleSubmit(async (v) => {
          const p = await create.mutateAsync(v);
          onClose();
          nav(`/p/${p.id}/overview`);
        })}
      >
        <Field label="Name" error={errors.name?.message}>
          <input
            autoFocus
            className={inputCls}
            placeholder="Production AWS account"
            {...register("name")}
          />
        </Field>
        <Field
          label="Description (optional)"
          error={errors.description?.message}
        >
          <textarea
            rows={2}
            className={inputCls}
            {...register("description")}
          />
        </Field>
        {create.isError && (
          <div role="alert" className="text-crit">
            {errorInfo(create.error).message}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" busy={create.isPending}>
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Projects() {
  const { data, isLoading, error, refetch } = useProjects();
  const del = useDeleteProject(),
    nav = useNavigate();
  const [sp] = useSearchParams(),
    [creating, setCreating] = useState(sp.get("new") === "1");
  const [deleting, setDeleting] = useState<Project | null>(null);
  const num = (n?: number) => <span className="tabular-nums">{n ?? "–"}</span>;
  return (
    <div className="p-5">
      <PageHeader
        title="Projects"
        sub="Each project holds one cloud environment and its scan history."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} />
            New project
          </Button>
        }
      />
      <Card>
        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorState
            message={errorInfo(error).message}
            onRetry={() => refetch()}
          />
        ) : (
          <DataTable
            rows={data!}
            rowKey={(p) => p.id}
            onRowClick={(p) => nav(`/p/${p.id}/overview`)}
            initialSort={{ key: "name", dir: 1 }}
            empty={
              <EmptyState
                title="No projects yet"
                body="Create a project, then import a cloud environment to see how exposed resources connect to sensitive assets."
                action={
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus size={14} />
                    New project
                  </Button>
                }
              />
            }
            cols={[
              {
                key: "name",
                header: "Name",
                sort: (p) => p.name.toLowerCase(),
                cell: (p) => (
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-muted">{p.description}</div>
                    )}
                  </div>
                ),
              },
              {
                key: "env",
                header: "Environment",
                cell: (p) =>
                  p.environmentName ?? (
                    <span className="text-muted">Not imported</span>
                  ),
              },
              {
                key: "scan",
                header: "Last scan",
                cell: (p) =>
                  p.lastScanAt ? (
                    fmtTime(p.lastScanAt)
                  ) : (
                    <span className="text-muted">Never</span>
                  ),
              },
              {
                key: "res",
                header: "Resources",
                sort: (p) => p.summary?.resources ?? -1,
                cell: (p) => num(p.summary?.resources),
              },
              {
                key: "fnd",
                header: "Findings",
                sort: (p) => p.summary?.findings ?? -1,
                cell: (p) => num(p.summary?.findings),
              },
              {
                key: "paths",
                header: "Attack paths",
                sort: (p) => p.summary?.paths ?? -1,
                cell: (p) => num(p.summary?.paths),
              },
              {
                key: "crit",
                header: "Critical",
                sort: (p) => p.summary?.criticalPaths ?? -1,
                cell: (p) => (
                  <span
                    className={`tabular-nums ${p.summary?.criticalPaths ? "text-crit" : ""}`}
                  >
                    {p.summary?.criticalPaths ?? "–"}
                  </span>
                ),
              },
              {
                key: "del",
                header: "",
                cell: (p) => (
                  <button
                    aria-label={`Delete ${p.name}`}
                    className="text-muted hover:text-crit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(p);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                ),
              },
            ]}
          />
        )}
      </Card>
      {creating && <NewProject onClose={() => setCreating(false)} />}
      {deleting && (
        <Modal title="Delete project" onClose={() => setDeleting(null)}>
          <p>
            Delete <span className="font-medium">{deleting.name}</span> and all
            of its scans? This cannot be undone.
          </p>
          {del.isError && (
            <div role="alert" className="mt-2 text-crit">
              {errorInfo(del.error).message}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={del.isPending}
              onClick={async () => {
                await del.mutateAsync(deleting.id);
                setDeleting(null);
              }}
            >
              Delete project
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
