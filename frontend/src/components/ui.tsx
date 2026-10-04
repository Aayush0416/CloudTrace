import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { SEV_ORDER, type Severity } from "../lib/types";

export const SEV: Record<
  Severity,
  { label: string; chip: string; hex: string }
> = {
  critical: { label: "Critical", chip: "bg-crit/15 text-crit", hex: "#ff4d4f" },
  high: { label: "High", chip: "bg-high/15 text-high", hex: "#ff7a59" },
  medium: { label: "Medium", chip: "bg-med/15 text-med", hex: "#b388ff" },
  low: { label: "Low", chip: "bg-low/15 text-low", hex: "#4da3ff" },
  info: { label: "Info", chip: "bg-info/15 text-info", hex: "#97a3ba" },
};
export const SeverityBadge = ({ s }: { s: Severity }) => (
  <span
    className={`inline-flex h-5 items-center rounded px-1.5 text-xs font-medium ${SEV[s].chip}`}
  >
    {SEV[s].label}
  </span>
);

const variants = {
  primary: "bg-accent text-bg hover:bg-accent-2 font-semibold",
  secondary:
    "border border-line bg-raised hover:border-navy-700 hover:bg-navy-700/40",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "bg-crit text-white hover:bg-crit/90 font-semibold",
};
export function Button({
  variant = "secondary",
  busy,
  className = "",
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  busy?: boolean;
}) {
  return (
    <button
      {...p}
      disabled={p.disabled || busy}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {busy && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
export const Card = ({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`rounded-md border border-line bg-panel ${className}`}>
    {title && (
      <header className="flex h-11 items-center justify-between border-b border-line px-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {actions}
      </header>
    )}
    {children}
  </section>
);
export const Loading = ({ label = "Loading" }: { label?: string }) => (
  <div className="flex items-center gap-2 p-6 text-muted">
    <Loader2 size={16} className="animate-spin" />
    {label}…
  </div>
);
export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div
    role="alert"
    className="m-4 flex items-start gap-2 rounded border border-crit/40 bg-crit/10 p-3 text-crit"
  >
    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
    <div className="flex-1">{message}</div>
    {onRetry && <Button onClick={onRetry}>Retry</Button>}
  </div>
);
export const EmptyState = ({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <div className="text-sm font-semibold">{title}</div>
    <p className="max-w-sm text-muted">{body}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>
);
export const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) => (
  <label className="block">
    <span className="mb-1 block text-muted">{label}</span>
    {children}
    {error && <span className="mt-1 block text-crit">{error}</span>}
  </label>
);
export const inputCls =
  "w-full min-h-8 rounded border border-line bg-bg px-2.5 py-1 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none";
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`w-full ${wide ? "max-w-xl" : "max-w-md"} rounded-md border border-line bg-panel shadow-2xl`}
      >
        <header className="flex h-12 items-center justify-between border-b border-line px-5">
          <h2 className="font-semibold">{title}</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export const PageHeader = ({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="mb-6 flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {sub && <div className="mt-1 text-muted">{sub}</div>}
    </div>
    <div className="flex gap-2">{actions}</div>
  </div>
);
export const Kpi = ({
  label,
  value,
  tone,
  delta,
  goodWhen = "down",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: string;
  delta?: number | null;
  goodWhen?: "up" | "down" | "none";
  icon?: ReactNode;
}) => {
  const good =
    delta == null || delta === 0 || goodWhen === "none"
      ? null
      : delta < 0 === (goodWhen === "down");
  return (
    <div className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-center justify-between text-muted">
        {label}
        {icon}
      </div>
      <div
        className={`mt-2 text-[28px] font-semibold leading-none ${tone ?? ""}`}
      >
        {value}
      </div>
      {delta !== undefined && (
        <div
          className={`mt-2 flex items-center gap-1 text-xs ${good === null ? "text-muted" : good ? "text-ok" : "text-crit"}`}
        >
          {delta == null ? (
            "No previous scan"
          ) : delta === 0 ? (
            "No change since last scan"
          ) : (
            <>
              {delta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(delta)} since last scan
            </>
          )}
        </div>
      )}
    </div>
  );
};

export interface Col<T> {
  key: string;
  header: string;
  cell: (r: T) => ReactNode;
  sort?: (r: T) => string | number;
  className?: string;
}
export function DataTable<T>({
  rows,
  cols,
  rowKey,
  onRowClick,
  initialSort,
  empty,
}: {
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  onRowClick?: (r: T) => void;
  initialSort?: { key: string; dir: 1 | -1 };
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const col = cols.find((c) => c.key === sort?.key);
  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a),
          y = col.sort!(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir;
      })
    : rows;
  if (!rows.length) return <>{empty}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-muted">
          <tr className="border-b border-line">
            {cols.map((c) => (
              <th
                key={c.key}
                className={`h-10 whitespace-nowrap px-4 font-medium ${c.className ?? ""}`}
              >
                {c.sort ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-fg"
                    onClick={() =>
                      setSort((s) => ({
                        key: c.key,
                        dir: s?.key === c.key && s.dir === 1 ? -1 : 1,
                      }))
                    }
                  >
                    {c.header}
                    {sort?.key === c.key &&
                      (sort.dir === 1 ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={() => onRowClick?.(r)}
              className={`border-b border-line/60 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-raised" : ""}`}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-2.5 align-middle ${c.className ?? ""}`}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export const sevSort = (s: Severity) => SEV_ORDER[s];
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex border-b border-line px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px h-10 border-b-2 px-3 ${value === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
export const ModeBadge = ({ mode = "demo" }: { mode?: string }) =>
  mode === "llm" ? (
    <span
      className="rounded border border-accent/50 px-1.5 py-0.5 text-xs text-accent"
      title="Generated by an advanced model from your scan data"
    >
      Auto
    </span>
  ) : (
    <span
      className="rounded border border-line px-1.5 py-0.5 text-xs text-muted"
      title="Built-in demo engine. No LLM is connected."
    >
      Demo mode
    </span>
  );
export const DemoBadge = ModeBadge;
