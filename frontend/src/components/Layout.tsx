import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import {
  Bell as BellIcon,
  Bot,
  Boxes,
  ChevronRight,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  UserCog,
  Waypoints,
  Wrench,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useActivity } from "../lib/activity";
import { ago } from "../lib/format";
import {
  fmtTime,
  useDiff,
  useProject,
  useProjects,
  useResult,
} from "../lib/queries";
import type { AttackPath, Finding, ResourceRow } from "../lib/types";

const PAGES: Record<string, string> = {
  overview: "Overview",
  "attack-paths": "Attack paths",
  findings: "Findings",
  resources: "Resources",
  reports: "Reports",
  remediation: "Remediation",
  assistant: "Security advisor",
  "audit-logs": "Audit log",
};
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function UserMenu() {
  const { user, logout } = useAuth(),
    nav = useNavigate(),
    [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-bg hover:bg-accent-2"
      >
        {initials(user?.name ?? "?")}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-60 rounded-md border border-line bg-panel py-1 shadow-2xl"
        >
          <div className="border-b border-line px-3 py-2">
            <div className="font-medium">{user?.name}</div>
            <div className="truncate text-muted">{user?.email}</div>
          </div>
          <Link
            role="menuitem"
            to="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-raised"
          >
            <UserCog size={14} />
            Manage account
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-raised"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function GlobalSearch({ projectId }: { projectId: string }) {
  const nav = useNavigate(),
    [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const res = useResult<ResourceRow[]>(projectId, "resources"),
    fin = useResult<Finding[]>(projectId, "findings"),
    paths = useResult<AttackPath[]>(projectId, "attack-paths");
  const term = q.trim().toLowerCase(),
    R = res.data?.data ?? [],
    name = (id: string) => R.find((r) => r.id === id)?.name ?? id,
    base = `/p/${projectId}`;
  const hits =
    term.length < 2
      ? []
      : [
          ...R.filter((r) => `${r.name} ${r.id}`.toLowerCase().includes(term))
            .slice(0, 4)
            .map((r) => ({
              kind: "Resource",
              text: r.name,
              sub: `${r.type} / ${r.subtype}`,
              to: `${base}/resources?q=${encodeURIComponent(r.name)}`,
            })),
          ...(fin.data?.data ?? [])
            .filter((f) =>
              `${f.title} ${f.ruleId} ${name(f.resourceId)}`
                .toLowerCase()
                .includes(term),
            )
            .slice(0, 4)
            .map((f) => ({
              kind: "Finding",
              text: f.title,
              sub: name(f.resourceId),
              to: `${base}/findings?q=${encodeURIComponent(f.title)}`,
            })),
          ...(paths.data?.data ?? [])
            .filter(
              (p) =>
                p.id.toLowerCase().includes(term) ||
                p.nodes.some((n) => name(n).toLowerCase().includes(term)),
            )
            .slice(0, 4)
            .map((p) => ({
              kind: "Path",
              text: p.id,
              sub: p.nodes.map(name).join(" → "),
              to: `${base}/attack-paths?path=${p.id}`,
            })),
        ];
  return (
    <div className="relative w-72">
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-2.5 text-muted"
      />
      <kbd className="pointer-events-none absolute right-2 top-1.5 z-10 rounded border border-line px-1.5 text-[11px] text-muted">
        /
      </kbd>
      <input
        ref={inputRef}
        aria-label="Search project"
        placeholder={
          projectId
            ? "Search resources, findings, paths"
            : "Select a project to search"
        }
        disabled={!projectId}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-8 w-full rounded border border-line bg-bg pl-8 pr-2 placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-50"
      />
      {open && term.length >= 2 && (
        <ul className="absolute left-0 top-10 z-40 max-h-80 w-96 overflow-auto rounded-md border border-line bg-panel py-1 shadow-2xl">
          {hits.length ? (
            hits.map((h) => (
              <li key={h.kind + h.to}>
                <button
                  onMouseDown={() => {
                    setQ("");
                    nav(h.to);
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-raised"
                >
                  <span className="w-16 shrink-0 text-xs text-muted">
                    {h.kind}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{h.text}</span>
                    <span className="block truncate text-xs text-muted">
                      {h.sub}
                    </span>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-muted">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

function SystemStatus({
  lastScanAt,
  show,
}: {
  lastScanAt: string | null;
  show: boolean;
}) {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get("/health")).data,
    refetchInterval: 30_000,
    retry: false,
  });
  return (
    <div className="m-2 rounded-md border border-line bg-bg p-3 text-xs">
      <div className="flex items-center gap-2 font-medium">
        <span
          className={`h-2 w-2 rounded-full ${health.isError ? "bg-crit" : "bg-ok"}`}
        />
        {health.isError ? "API unreachable" : "API online"}
      </div>
      {show && (
        <div className="mt-1 text-muted">Last scan: {ago(lastScanAt)}</div>
      )}
    </div>
  );
}

function NotificationBell({ projectId }: { projectId: string }) {
  const items = useActivity(projectId),
    diff = useDiff(projectId),
    [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    count = diff.data?.newPaths.length ?? 0;
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications${count ? `, ${count} new attack paths` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-raised hover:text-fg"
      >
        <BellIcon size={16} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-crit px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-80 rounded-md border border-line bg-panel shadow-2xl">
          <div className="border-b border-line px-3 py-2 font-semibold">
            Recent activity
          </div>
          {items.length ? (
            <ul className="max-h-80 overflow-auto">
              {items.slice(0, 6).map((a) => (
                <li
                  key={a.key}
                  className="border-b border-line/60 px-3 py-2 last:border-0"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {ago(a.at)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted">{a.sub}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-muted">
              {projectId
                ? "Nothing yet. Run a scan to start the feed."
                : "Select a project to see activity."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const nav = useNavigate(),
    loc = useLocation(),
    match = useMatch("/p/:projectId/:page");
  const [stored, setStored] = useState(localStorage.getItem("ct_project"));
  const projectId = match?.params.projectId ?? stored ?? "";
  useEffect(() => {
    if (match?.params.projectId) {
      localStorage.setItem("ct_project", match.params.projectId);
      setStored(match.params.projectId);
    }
  }, [match?.params.projectId]);
  const projects = useProjects(),
    valid = !!projectId && !!projects.data?.some((p) => p.id === projectId),
    current = useProject(valid ? projectId : "");
  const to = (page: string) =>
    valid ? `/p/${projectId}/${page}` : "/projects";
  const groups = [
    {
      name: "Workspace",
      items: [
        { to: "/home", label: "Home", icon: Home },
        { to: "/projects", label: "Projects", icon: FolderKanban },
        {
          to: to("overview"),
          label: "Overview",
          icon: LayoutDashboard,
          needs: true,
        },
      ],
    },
    {
      name: "Investigate",
      items: [
        {
          to: to("attack-paths"),
          label: "Attack paths",
          icon: RouteIcon,
          needs: true,
        },
        {
          to: to("findings"),
          label: "Findings",
          icon: ShieldAlert,
          needs: true,
        },
        { to: to("resources"), label: "Resources", icon: Boxes, needs: true },
        { to: to("reports"), label: "Reports", icon: FileText, needs: true },
      ],
    },
    {
      name: "Respond",
      items: [
        {
          to: to("remediation"),
          label: "Remediation",
          icon: Wrench,
          needs: true,
        },
        {
          to: to("assistant"),
          label: "Security advisor",
          icon: Bot,
          needs: true,
        },
        {
          to: to("audit-logs"),
          label: "Audit log",
          icon: FileText,
          needs: true,
        },
      ],
    },
  ];
  const page = match
    ? PAGES[match.params.page!]
    : ((
        {
          "/projects": "Projects",
          "/home": "Home",
          "/account": "Account",
        } as Record<string, string>
      )[loc.pathname] ?? "");
  return (
    <div className="flex h-full">
      <aside className="app-chrome flex w-56 shrink-0 flex-col border-r border-line bg-panel">
        <Link
          to="/home"
          className="flex h-12 items-center gap-2 border-b border-line px-4 font-semibold"
        >
          <Waypoints size={18} className="text-accent" />
          CloudTrace
        </Link>
        <nav className="flex-1 space-y-5 overflow-auto p-2 pt-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="px-2.5 pb-1.5 text-xs text-muted">{g.name}</div>
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <NavLink
                    key={i.label}
                    to={i.to}
                    title={
                      i.needs && !valid ? "Select a project first" : undefined
                    }
                    className={({ isActive }) =>
                      `flex h-8 items-center gap-2.5 rounded border-l-2 px-2.5 ${isActive && (!i.needs || valid) ? "border-accent bg-raised text-fg" : "border-transparent text-muted hover:bg-raised hover:text-fg"} ${i.needs && !valid ? "opacity-50" : ""}`
                    }
                  >
                    <i.icon size={15} />
                    {i.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <SystemStatus
          show={valid}
          lastScanAt={valid ? (current.data?.lastScanAt ?? null) : null}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-chrome flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-muted"
          >
            {valid && match && (
              <>
                <span className="max-w-40 truncate text-fg">
                  {current.data?.name ?? "…"}
                </span>
                <ChevronRight size={13} />
              </>
            )}
            <span className={valid && match ? "" : "text-fg"}>{page}</span>
          </nav>
          <div className="mx-auto">
            <GlobalSearch projectId={valid ? projectId : ""} />
          </div>
          <label className="flex items-center gap-2 text-muted">
            Project
            <select
              aria-label="Project"
              value={valid ? projectId : ""}
              onChange={(e) =>
                e.target.value &&
                nav(`/p/${e.target.value}/${match?.params.page ?? "overview"}`)
              }
              className="h-8 max-w-44 rounded border border-line bg-bg px-2 text-fg"
            >
              <option value="">
                {projects.data?.length ? "Select project" : "No projects"}
              </option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {valid && (
            <span className="hidden text-muted xl:inline">
              Last scan: {fmtTime(current.data?.lastScanAt ?? null)}
            </span>
          )}
          <NotificationBell projectId={valid ? projectId : ""} />
          <UserMenu />
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
