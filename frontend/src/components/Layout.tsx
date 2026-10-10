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
  Menu,
  X,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  UserCog,
  Waypoints,
  Wrench,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import ThemeToggle from "./ThemeToggle";
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand hover:bg-brand-2"
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
            Account settings
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
    [active, setActive] = useState(0),
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
  const projects = useProjects(),
    res = useResult<ResourceRow[]>(projectId, "resources"),
    fin = useResult<Finding[]>(projectId, "findings"),
    paths = useResult<AttackPath[]>(projectId, "attack-paths");
  const term = q.trim().toLowerCase(),
    R = res.data?.data ?? [],
    name = (id: string) => R.find((r) => r.id === id)?.name ?? id,
    base = `/p/${projectId}`,
    has = (...t: string[]) => t.join(" ").toLowerCase().includes(term);

  type Hit = { kind: string; text: string; sub: string; to: string };
  // Search works with or without a project: pages and projects are always searched; resources, findings and
  // attack paths are added when a project is open.
  const pages: Hit[] = [
    { kind: "Page", text: "Home", sub: "Dashboard", to: "/home" },
    { kind: "Page", text: "Projects", sub: "All projects", to: "/projects" },
    { kind: "Page", text: "Account settings", sub: "Theme, preferences, profile", to: "/account" },
    ...(projectId
      ? [
          ["Overview", "overview"],
          ["Attack paths", "attack-paths"],
          ["Findings", "findings"],
          ["Resources", "resources"],
          ["Reports", "reports"],
          ["Remediation", "remediation"],
          ["Security advisor", "assistant"],
          ["Audit log", "audit-logs"],
        ].map(([text, p]) => ({ kind: "Page", text, sub: "Current project", to: `${base}/${p}` }))
      : []),
  ];
  const hits: Hit[] = !term
    ? []
    : [
        ...pages.filter((p) => has(p.text, p.sub)).slice(0, 4),
        ...(projects.data ?? [])
          .filter((p) => has(p.name, p.environmentName ?? ""))
          .slice(0, 4)
          .map((p) => ({
            kind: "Project",
            text: p.name,
            sub: p.environmentName ?? "No environment yet",
            to: `/p/${p.id}/overview`,
          })),
        ...R.filter((r) => has(r.name, r.id))
          .slice(0, 4)
          .map((r) => ({
            kind: "Resource",
            text: r.name,
            sub: `${r.type} / ${r.subtype}`,
            to: `${base}/resources?q=${encodeURIComponent(r.name)}`,
          })),
        ...(fin.data?.data ?? [])
          .filter((f) => has(f.title, f.ruleId, name(f.resourceId)))
          .slice(0, 4)
          .map((f) => ({
            kind: "Finding",
            text: f.title,
            sub: name(f.resourceId),
            to: `${base}/findings?q=${encodeURIComponent(f.title)}`,
          })),
        ...(paths.data?.data ?? [])
          .filter((p) => has(p.id) || p.nodes.some((n) => has(name(n))))
          .slice(0, 4)
          .map((p) => ({
            kind: "Path",
            text: p.id,
            sub: p.nodes.map(name).join(" → "),
            to: `${base}/attack-paths?path=${p.id}`,
          })),
      ];
  const go = (h: Hit) => {
    setQ("");
    setOpen(false);
    inputRef.current?.blur();
    nav(h.to);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        hits.length ? (i + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length : 0,
      );
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };
  return (
    <div className="relative w-full md:w-72">
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-3 text-muted md:top-2.5"
      />
      <kbd className="pointer-events-none absolute right-2 top-1.5 z-10 hidden rounded border border-line px-1.5 text-[11px] text-muted md:block">
        /
      </kbd>
      <input
        ref={inputRef}
        aria-label="Search"
        role="combobox"
        aria-expanded={open && !!term}
        aria-controls="global-search-results"
        autoComplete="off"
        placeholder={projectId ? "Search resources, findings, pages" : "Search projects and pages"}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKey}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-9 w-full rounded-md border border-line bg-bg pl-8 pr-8 placeholder:text-muted/70 focus:border-accent focus:outline-none md:h-8"
      />
      {open && term && (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute left-0 top-11 z-50 max-h-80 w-[min(24rem,calc(100vw-1.5rem))] overflow-auto rounded-lg border border-line bg-panel py-1 shadow-2xl md:top-10"
        >
          {hits.length ? (
            hits.map((h, i) => (
              <li key={h.kind + h.to} role="option" aria-selected={i === active}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(h);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left ${i === active ? "bg-raised" : ""}`}
                >
                  <span className="w-16 shrink-0 text-xs text-muted">{h.kind}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{h.text}</span>
                    <span className="block truncate text-xs text-muted">{h.sub}</span>
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-muted">No matches for "{q.trim()}"</li>
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
        <div className="absolute right-0 top-10 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-md border border-line bg-panel shadow-2xl">
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
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [drawer]);
  const projectSelect = (
    <label className="flex items-center gap-2 text-muted">
      <span className="md:sr-only xl:not-sr-only">Project</span>
      <select
        aria-label="Project"
        value={valid ? projectId : ""}
        onChange={(e) =>
          e.target.value &&
          nav(`/p/${e.target.value}/${match?.params.page ?? "overview"}`)
        }
        className="h-9 w-full min-w-0 rounded border border-line bg-bg px-2 text-fg md:h-8 md:max-w-44"
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
  );
  return (
    <div className="flex h-full">
      {drawer && (
        <div
          aria-hidden
          onClick={() => setDrawer(false)}
          className="app-chrome fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden"
        />
      )}
      <aside
        id="app-nav"
        className={`app-chrome fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-line bg-chrome transition-transform duration-200 lg:static lg:z-auto lg:w-56 lg:max-w-none lg:translate-x-0 ${drawer ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Link
          to="/home"
          className="flex h-14 items-center gap-2 border-b border-line px-4 font-semibold"
        >
          <Waypoints size={18} className="text-accent" />
          CloudTrace
          <button
            type="button"
            aria-label="Close menu"
            onClick={(e) => {
              e.preventDefault();
              setDrawer(false);
            }}
            className="ml-auto rounded p-1.5 text-muted hover:bg-raised hover:text-fg lg:hidden"
          >
            <X size={18} />
          </button>
        </Link>
        <div className="space-y-3 border-b border-line p-3 md:hidden">
          <GlobalSearch projectId={valid ? projectId : ""} />
          {projectSelect}
        </div>
        <nav className="flex-1 space-y-5 overflow-auto p-2 pt-4">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted/80">
                {g.name}
              </div>
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <NavLink
                    key={i.label}
                    to={i.to}
                    title={
                      i.needs && !valid ? "Select a project first" : undefined
                    }
                    className={({ isActive }) =>
                      `flex h-10 items-center gap-2.5 rounded-r-md border-l-[3px] px-2.5 transition-colors lg:h-9 ${isActive && (!i.needs || valid) ? "border-accent bg-raised font-medium text-heading" : "border-transparent text-muted hover:bg-raised hover:text-fg"} ${i.needs && !valid ? "opacity-50" : ""}`
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
        <header className="app-chrome flex h-14 shrink-0 items-center gap-2 border-b border-line bg-chrome px-3 sm:gap-3 sm:px-4 lg:gap-4">
          <button
            type="button"
            aria-label="Open menu"
            aria-controls="app-nav"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded text-muted hover:bg-raised hover:text-fg lg:hidden"
          >
            <Menu size={20} />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-muted md:flex-none"
          >
            {valid && match && (
              <>
                <span className="hidden max-w-40 truncate text-fg sm:inline">
                  {current.data?.name ?? "…"}
                </span>
                <ChevronRight size={13} className="hidden sm:block" />
              </>
            )}
            <span
              className={`truncate ${valid && match ? "" : "text-fg"}`}
            >
              {page}
            </span>
          </nav>
          <div className="mx-auto hidden md:block">
            <GlobalSearch projectId={valid ? projectId : ""} />
          </div>
          <div className="hidden md:block">{projectSelect}</div>
          {valid && (
            <span className="hidden text-muted xl:inline">
              Last scan: {fmtTime(current.data?.lastScanAt ?? null)}
            </span>
          )}
          <ThemeToggle />
          <NotificationBell projectId={valid ? projectId : ""} />
          <UserMenu />
        </header>
        {valid && current.data?.stale && (
          <div
            role="status"
            className="shrink-0 border-b border-med/40 bg-med/10 px-4 py-1.5 text-med"
          >
            The environment was re-imported after the last scan, so these
            results describe the previous version. Import and scan again to
            refresh them.
          </div>
        )}
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
