import type { WhatIf } from "../lib/types";
import { SeverityBadge } from "./ui";

export default function WhatIfResult({
  data,
  label,
}: {
  data: WhatIf;
  label: (id: string) => string;
}) {
  const rows: [string, number, number][] = [
    ["Attack paths", data.before.paths, data.after.paths],
    ["Critical paths", data.before.critical, data.after.critical],
    ["Findings", data.before.findings, data.after.findings],
  ];
  return (
    <div className="space-y-3 rounded border border-line bg-bg p-3">
      <div className="font-medium">{data.label}</div>
      <table className="w-full text-left">
        <thead className="text-muted">
          <tr>
            <th className="py-1 font-medium">Metric</th>
            <th className="font-medium">Before</th>
            <th className="font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([n, b, a]) => (
            <tr key={n} className="border-t border-line/60">
              <td className="py-1">{n}</td>
              <td className="tabular-nums">{b}</td>
              <td
                className={`tabular-nums ${a < b ? "text-ok" : a > b ? "text-crit" : ""}`}
              >
                {a}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.targetsProtected.length > 0 && (
        <div>
          <div className="text-muted">No longer reachable</div>
          <div className="text-ok">
            {data.targetsProtected.map(label).join(", ")}
          </div>
        </div>
      )}
      {data.removed.length > 0 && (
        <div>
          <div className="mb-1 text-muted">Paths removed</div>
          <ul className="space-y-1">
            {data.removed.map((p) => (
              <li key={p.nodes.join()} className="flex items-center gap-2">
                <SeverityBadge s={p.severity} />
                <span className="truncate">
                  {p.nodes.map(label).join(" → ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.changed.length > 0 && (
        <div>
          <div className="mb-1 text-muted">Score changes</div>
          {data.changed.map((c) => (
            <div key={c.nodes.join()}>
              {c.nodes.map(label).join(" → ")}: {c.from} → {c.to}
            </div>
          ))}
        </div>
      )}
      {data.added.length > 0 && (
        <div className="text-crit">
          {data.added.length} new path{data.added.length > 1 ? "s" : ""}{" "}
          appeared.
        </div>
      )}
      {data.removed.length === 0 && data.changed.length === 0 && (
        <div className="text-muted">
          This change doesn't affect any attack path.
        </div>
      )}
      <p className="text-xs text-muted">
        Simulated on a copy. Your imported environment is unchanged.
      </p>
    </div>
  );
}
