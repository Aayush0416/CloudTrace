import { useDiff, useFindingStates, useResult, useScans } from "./queries";
import type { ResourceRow } from "./types";

export interface ActivityItem {
  key: string;
  tone: "crit" | "high" | "ok" | "info";
  title: string;
  sub: string;
  at: string;
}

/** Recent events derived from real data: scans, path changes between scans and finding status updates. */
export function useActivity(id: string): ActivityItem[] {
  const scans = useScans(id),
    diff = useDiff(id),
    states = useFindingStates(id),
    res = useResult<ResourceRow[]>(id, "resources");
  const nm = (rid: string) =>
    res.data?.data.find((r) => r.id === rid)?.name ??
    (rid === "internet" ? "Internet" : rid);
  const items: ActivityItem[] = [];
  for (const s of (scans.data ?? []).slice(-3))
    if (s.completedAt && s.summary)
      items.push({
        key: `scan-${s.id}`,
        tone: "info",
        title: "Scan completed",
        sub: `${s.summary.paths} attack paths, ${s.summary.criticalPaths} critical, ${s.summary.resources} resources`,
        at: s.completedAt,
      });
  if (diff.data) {
    for (const p of diff.data.newPaths.slice(0, 3))
      items.push({
        key: `new-${p.id}-${p.nodes.join()}`,
        tone: p.severity === "critical" ? "crit" : "high",
        title: `New ${p.severity} attack path`,
        sub: p.nodes.map(nm).join(" → "),
        at: diff.data.currentAt,
      });
    for (const p of diff.data.resolvedPaths.slice(0, 3))
      items.push({
        key: `res-${p.id}-${p.nodes.join()}`,
        tone: "ok",
        title: "Attack path resolved",
        sub: p.nodes.map(nm).join(" → "),
        at: diff.data.currentAt,
      });
  }
  for (const f of (states.data ?? []).filter(
    (x) => x.status !== "open" && x.updatedAt,
  ))
    items.push({
      key: `fs-${f.ruleId}${f.resourceId}`,
      tone: f.status === "fixed" ? "ok" : "info",
      title: `Finding ${f.status === "accepted" ? "risk accepted" : f.status}`,
      sub: `${f.ruleId} on ${nm(f.resourceId)}`,
      at: f.updatedAt!,
    });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}
