import { usePrefs } from "../../lib/prefs";
import ThemeToggle from "../../components/ThemeToggle";
import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowRight,
  Bot,
  FlaskConical,
  GitBranch,
  Layers,
  ShieldAlert,
  Waypoints,
  Wrench,
} from "lucide-react";
import sample from "./sample.json";
import { buildFlow, edgeTypes, nodeTypes } from "../attack-paths/graphKit";
import { useGraphHover } from "../attack-paths/GraphHover";
import type { AttackPath, GraphData, ResourceRow } from "../../lib/types";

const Graph3D = lazy(() => import("../../components/Graph3D"));
const paths = sample.paths as unknown as AttackPath[];
/** The same graph component the product uses, on the bundled enterprise sample. */
const FLOW = buildFlow({
  g: sample.graph as unknown as GraphData,
  resources: sample.resources as unknown as ResourceRow[],
  all: paths,
  filtered: paths,
  selected: null,
  hood: null,
  scope: "",
  choke: new Map(sample.chokePoints.map((c) => [c.id, c.paths])),
  dir: "LR",
  showAll: true,
  mode: "all",
});

const CHOKE = new Map(sample.chokePoints.map((c) => [c.id, c.paths]));
const SAMPLE_GRAPH = sample.graph as unknown as GraphData;
const SAMPLE_ROWS = sample.resources as unknown as ResourceRow[];

const STATS = [
  ["4", "graph algorithms", "DFS, BFS, Dijkstra, Yen"],
  ["12", "security rules", "network, IAM, storage, secrets, database"],
  ["ATT&CK", "mapped steps", "a technique on every hop"],
  ["0", "exploits run", "modeled reachability only"],
];
const STEPS = [
  [
    "Import",
    "Upload a normalized cloud environment as JSON. Every resource and reference is validated first.",
  ],
  [
    "Analyze",
    "Rules raise findings, then a graph links exposure, identities, permissions and network access.",
  ],
  [
    "Investigate",
    "Follow ranked attack paths from entry points to sensitive assets, with the evidence behind each step.",
  ],
  [
    "Fix",
    "Simulate a change on a copy, compare before and after, and fix what breaks the most paths.",
  ],
];
const FEATURES = [
  [
    GitBranch,
    "Every branch, ranked",
    "DFS finds all routes. Dijkstra and Yen's K-shortest rank the most likely ones, so the critical branches stand out.",
  ],
  [
    ShieldAlert,
    "Explainable risk",
    "Each score shows its five factors. It is a project model and is never presented as an industry standard.",
  ],
  [
    Layers,
    "Network aware",
    "Security group rules become lateral movement. Placement alone never counts as an attacker step.",
  ],
  [
    FlaskConical,
    "What-if simulation",
    "Remove a permission or exposure on a copy and see which paths and targets are affected.",
  ],
  [
    Wrench,
    "Fix ranking",
    "Single changes ranked by how many attack paths they remove, critical paths first.",
  ],
  [
    Bot,
    "Contextual Security Advisor",
    "The built-in advisor explains what the deterministic engine found in plain language.",
  ],
] as const;

export default function Landing() {
  const { theme } = usePrefs();
  const hover = useGraphHover({
    g: SAMPLE_GRAPH,
    resources: SAMPLE_ROWS,
    paths,
    choke: CHOKE,
  });
  const navLink =
    "relative py-1 text-[15px] font-medium text-fg/80 transition-colors hover:text-heading after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-brand after:transition-transform hover:after:scale-x-100";
  const eyebrow =
    "mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent";
  return (
    <div className="display h-full overflow-auto bg-bg">
      {/* navy in both themes, like the app's own top bar */}
      <header className="on-dark sticky top-0 z-30 border-b border-line/60 bg-hero/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold text-heading"
          >
            <Waypoints className="text-accent" />
            CloudTrace
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#how" className={navLink}>
              Workflow
            </a>
            <a href="#graph" className={navLink}>
              Live graph
            </a>
            <a href="#features" className={navLink}>
              Capabilities
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              to="/register"
              className="hidden h-9 items-center rounded-md px-3 text-fg/80 hover:text-heading sm:inline-flex"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-2"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* The 3D attack graph is the hero's background; a soft fade on the left keeps the headline readable. */}
      <section className="on-dark relative isolate overflow-hidden bg-hero">
        <Suspense fallback={null}>
          <Graph3D
            variant="hero"
            className="absolute inset-0 -z-20 h-full w-full opacity-45 sm:opacity-70 lg:opacity-100"
          />
        </Suspense>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [background:linear-gradient(to_right,var(--color-hero)_26%,color-mix(in_srgb,var(--color-hero)_72%,transparent)_48%,transparent_80%)] max-lg:[background:linear-gradient(to_bottom,color-mix(in_srgb,var(--color-hero)_88%,transparent),color-mix(in_srgb,var(--color-hero)_55%,transparent))]"
        />
        <div className="mx-auto flex min-h-[560px] max-w-6xl items-center px-4 py-16 sm:px-6 lg:min-h-[640px]">
          <div className="max-w-2xl">
            <p className={eyebrow}>Cloud attack path analysis</p>
            <h1 className="text-[36px] font-semibold leading-[1.1] sm:text-[48px] lg:text-[60px]">
              Trace the route to your data before an attacker does.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              CloudTrace maps exposed resources, identities, permissions and
              network access into one graph, then ranks every path an attacker
              could take to reach what matters.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/login"
                className="inline-flex h-12 items-center gap-2 rounded-md bg-brand px-7 font-semibold text-on-brand shadow-lg shadow-black/20 transition-colors hover:bg-brand-2"
              >
                Sign in
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/register"
                className="inline-flex h-12 items-center rounded-md border border-fg/30 px-7 font-medium text-heading transition-colors hover:border-brand hover:text-brand"
              >
                Create an account
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Analysis only. CloudTrace never exploits or changes your
              environment.
            </p>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-4 right-6 hidden items-center gap-2 text-xs text-muted sm:flex">
          <span className="h-0.5 w-5 bg-brand" />
          Highlighted route from entry point to target. Illustrative model.
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-9 sm:px-6 md:grid-cols-4">
          {STATS.map(([n, t, d]) => (
            <div key={t} className="border-l-[3px] border-brand pl-4">
              <div className="text-3xl font-semibold text-heading">{n}</div>
              <div className="mt-1 font-medium">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className={eyebrow}>Workflow</p>
        <h2 className="max-w-2xl text-[28px] font-semibold leading-tight sm:text-[34px]">
          Four steps from a file to a fix list
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <div
              key={t}
              className="rounded-lg border border-line bg-panel p-6 shadow-[var(--card-shadow)]"
            >
              <div className="font-display text-[40px] font-semibold leading-none text-accent">
                {i + 1}
              </div>
              <h3 className="mt-4 text-base font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="graph" className="border-y border-line bg-panel py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className={eyebrow}>Live graph</p>
          <h2 className="max-w-2xl text-[28px] font-semibold leading-tight sm:text-[34px]">
            See every route in one graph
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            This is the real graph component on a bundled sample environment
            with two entry points and several sensitive targets. Every branch is
            drawn. Line style shows the kind of link, ring colour shows risk,
            and critical branches are heavier. Hover anything for details.
          </p>
          <div className="mt-8 h-[500px] overflow-hidden rounded-lg border border-line bg-bg shadow-[var(--card-shadow)]">
            {hover.tip}
            <ReactFlow
              {...hover.bind}
              nodes={FLOW.nodes}
              edges={FLOW.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              colorMode={theme}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              panOnDrag={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--graph-dots)" gap={26} />
            </ReactFlow>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className={eyebrow}>Capabilities</p>
        <h2 className="max-w-2xl text-[28px] font-semibold leading-tight sm:text-[34px]">
          Everything you need to investigate and fix
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map(([Icon, t, d]) => (
            <div
              key={t}
              className="group rounded-lg border border-line bg-panel p-6 shadow-[var(--card-shadow)] transition duration-200 hover:-translate-y-0.5 hover:border-brand"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/15 text-accent transition-colors group-hover:bg-brand group-hover:text-on-brand">
                <Icon size={21} />
              </span>
              <h3 className="mt-4 text-base font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="on-dark bg-chrome">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-[28px] font-semibold leading-tight sm:text-[32px]">
              Find the route before someone else does.
            </h2>
            <p className="mt-2 text-muted">
              Sign in, import an environment and get your first ranked paths in
              a minute.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-brand px-7 font-semibold text-on-brand transition-colors hover:bg-brand-2"
          >
            Sign in
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        CloudTrace · Cloud attack path analysis
      </footer>
    </div>
  );
}
