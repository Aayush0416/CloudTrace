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
import { buildFlow, nodeTypes } from "../attack-paths/graphKit";
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
  return (
    <div className="h-full overflow-auto bg-bg">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <Waypoints className="text-accent" />
            CloudTrace
          </Link>
          <nav className="hidden items-center gap-7 text-muted md:flex">
            <a href="#how" className="hover:text-fg">
              How it works
            </a>
            <a href="#graph" className="hover:text-fg">
              The graph
            </a>
            <a href="#features" className="hover:text-fg">
              Features
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/register"
              className="hidden h-9 items-center rounded px-3 text-muted hover:text-fg sm:inline-flex"
            >
              Create account
            </Link>
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded bg-accent px-4 font-semibold text-bg hover:bg-accent-2"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-4 text-sm font-medium text-accent">
            Cloud attack path analysis
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] lg:text-[52px]">
            Trace the route to your data before an attacker does.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            CloudTrace maps exposed resources, identities, permissions and
            network access into one graph, then ranks every path an attacker
            could take to reach what matters.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex h-11 items-center gap-2 rounded bg-accent px-6 font-semibold text-bg hover:bg-accent-2"
            >
              Sign in
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              className="inline-flex h-11 items-center rounded border border-line px-6 hover:bg-raised"
            >
              Create an account
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted">
            Analysis only. CloudTrace never exploits or changes your
            environment.
          </p>
        </div>
        <div className="relative h-[400px] overflow-hidden rounded-md border border-line bg-[radial-gradient(ellipse_at_center,var(--color-navy-800)_0%,#000_72%)]">
          <Suspense fallback={null}>
            <Graph3D variant="hero" className="h-full w-full" />
          </Suspense>
          <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2 text-xs text-muted">
            <span className="h-0.5 w-5 bg-accent" />
            Highlighted route from entry point to target. Illustrative model.
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
          {STATS.map(([n, t, d]) => (
            <div key={t}>
              <div className="text-3xl font-semibold text-white">{n}</div>
              <div className="mt-1 font-medium">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold">
          From a JSON file to a ranked list of routes
        </h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="bg-bg p-6">
              <div className="font-mono text-sm text-accent">0{i + 1}</div>
              <h3 className="mt-3 text-base font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="graph" className="border-y border-line bg-panel py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold">The graph is the product</h2>
          <p className="mt-2 max-w-2xl text-muted">
            This is the real graph component on a bundled sample environment
            with two entry points and several sensitive targets. Every branch is
            drawn. Line style shows the kind of link, ring colour shows risk,
            and critical branches are heavier.
          </p>
          <div className="mt-8 h-[500px] overflow-hidden rounded-md border border-line bg-bg">
            <ReactFlow
              nodes={FLOW.nodes}
              edges={FLOW.edges}
              nodeTypes={nodeTypes}
              colorMode="dark"
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
              <Background color="#10182b" gap={26} />
            </ReactFlow>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold">Built for investigation</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FEATURES.map(([Icon, t, d]) => (
            <div key={t} className="rounded-md border border-line bg-panel p-6">
              <Icon size={20} className="text-accent" />
              <h3 className="mt-4 text-base font-semibold">{t}</h3>
              <p className="mt-2 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">
              See your own environment as an attacker would.
            </h2>
            <p className="mt-2 text-muted">
              Sign in, import an environment and get your first ranked paths in
              a minute.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded bg-accent px-6 font-semibold text-bg hover:bg-accent-2"
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
