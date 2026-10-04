import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./api";
import type { Project, ScanRow } from "./types";

export const useProjects = () =>
  useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects")).data,
  });
export const useProject = (id: string) =>
  useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
    enabled: !!id,
  });
export const useScans = (id: string) =>
  useQuery({
    queryKey: ["scans", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<ScanRow[]>(`/projects/${id}/scans`)).data,
  });
export function useResult<T>(
  id: string,
  key: "resources" | "findings" | "attack-paths" | "graph" | "choke-points",
) {
  return useQuery({
    queryKey: ["result", id, key],
    enabled: !!id,
    queryFn: async () =>
      (
        await api.get<{
          scanId: string | null;
          completedAt: string | null;
          data: T;
          truncated?: boolean;
        }>(`/projects/${id}/${key}`)
      ).data,
  });
}
const refresh = (qc: QueryClient, id: string) =>
  ["projects", "project", "result", "scans", "remediations", "diff"].forEach(
    (k) => qc.invalidateQueries({ queryKey: k === "projects" ? [k] : [k, id] }),
  );
export function useRunScan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post(`/projects/${id}/scan`)).data,
    onSuccess: () => refresh(qc, id),
  });
}
export function useImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (env: unknown) =>
      (await api.post(`/projects/${id}/import`, env)).data,
    onSuccess: () => refresh(qc, id),
  });
}
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { name: string; description?: string }) =>
      (await api.post<Project>("/projects", b)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
export const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

import type { AiResult, ChatReply, Change, Remediation, WhatIf } from "./types";
export const useRemediations = (id: string) =>
  useQuery({
    queryKey: ["remediations", id],
    queryFn: async () =>
      (await api.get<Remediation[]>(`/projects/${id}/remediations`)).data,
  });
export const useWhatIf = (id: string) =>
  useMutation({
    mutationFn: async (change: Change) =>
      (await api.post<WhatIf>(`/projects/${id}/what-if`, { change })).data,
  });
export const useAi = (id: string) =>
  useMutation({
    mutationFn: async (v: {
      pathId: string;
      kind: "explain" | "remediation";
    }) =>
      (
        await api.post<AiResult>(
          `/projects/${id}/attack-paths/${v.pathId}/${v.kind}`,
        )
      ).data,
  });
export const useAssistant = (id: string) =>
  useMutation({
    mutationFn: async (question: string) =>
      (await api.post<ChatReply>(`/projects/${id}/assistant`, { question }))
        .data,
  });

import type { AuthConfig, Diff, FindingState, FindingStatus } from "./types";
export const useAuthConfig = () =>
  useQuery({
    queryKey: ["authcfg"],
    staleTime: 60_000,
    queryFn: async () => (await api.get<AuthConfig>("/auth/config")).data,
  });
export const useDiff = (id: string) =>
  useQuery({
    queryKey: ["diff", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<Diff | null>(`/projects/${id}/diff`)).data,
  });
export const useFindingStates = (id: string) =>
  useQuery({
    queryKey: ["fstates", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<FindingState[]>(`/projects/${id}/finding-states`)).data,
  });
export function useSetFindingState(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      ruleId: string;
      resourceId: string;
      status: FindingStatus;
      note?: string;
    }) => (await api.put(`/projects/${id}/finding-states`, v)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fstates", id] }),
  });
}
