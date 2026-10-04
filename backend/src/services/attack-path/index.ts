import {
  INTERNET,
  STRUCTURAL,
  type SecurityGraph,
  type EdgeMeta,
} from "../graph";
import { EXPLOIT_WEIGHT } from "../risk";

export interface PathEdge extends EdgeMeta {
  key: string;
  source: string;
  target: string;
}
export interface AttackPath {
  id: string;
  entryPoint: string;
  target: string;
  nodes: string[];
  edges: PathEdge[];
  isShortest: boolean; // BFS: fewest hops to this target
  cost: number; // sum of edge costs
  likelihood: number; // exp(-cost): product of per-edge success estimates
  costRank: number | null; // Yen's K-shortest: 1 = most likely route to this target, null = outside top K
}
interface Route {
  nodes: string[];
  edges: PathEdge[];
  cost: number;
}

const TARGET_TYPES = new Set(["storage", "database", "secret"]);
const HIGH = new Set(["high", "critical"]);
export const TOP_K = 5,
  MAX_PATHS = 500;
type Adj = Map<string, PathEdge[]>;

/** Edge cost = -ln(confidence x exploitability weight) >= 0, so the cheapest path is the most likely one (costs add, probabilities multiply). */
export const edgeCost = (e: EdgeMeta) =>
  -Math.log(Math.min(0.999, e.confidence * (EXPLOIT_WEIGHT[e.type] ?? 0.5)));
const sig = (edges: PathEdge[]) => edges.map((e) => e.key).join(">");

export function adjacency(g: SecurityGraph): Adj {
  const adj: Adj = new Map();
  for (const n of g.nodes().sort())
    adj.set(
      n,
      g
        .outEdges(n)
        .sort()
        .filter((k) => !STRUCTURAL.has(g.getEdgeAttribute(k, "type")))
        .map((k) => ({
          key: k,
          source: n,
          target: g.target(k),
          ...(g.getEdgeAttributes(k) as EdgeMeta),
        })),
    );
  return adj;
}
export const findEntryPoints = (g: SecurityGraph) => {
  const adj = adjacency(g);
  return g
    .nodes()
    .filter(
      (n) =>
        (n === INTERNET || g.getNodeAttribute(n, "compromised")) &&
        (adj.get(n)?.length ?? 0) > 0,
    )
    .sort((a, b) =>
      a === INTERNET ? -1 : b === INTERNET ? 1 : a.localeCompare(b),
    );
};
export const findTargets = (g: SecurityGraph) =>
  g
    .nodes()
    .filter((n) => {
      const a = g.getNodeAttributes(n);
      return TARGET_TYPES.has(a.type) && HIGH.has(a.criticality);
    })
    .sort();

/** BFS: minimum hop count from `from` to `to`, or null if unreachable. */
export function shortestHops(
  adj: Adj,
  from: string,
  to: string,
): number | null {
  const dist = new Map([[from, 0]]),
    q = [from];
  for (let i = 0; i < q.length; i++) {
    const n = q[i];
    if (n === to) return dist.get(n)!;
    for (const e of adj.get(n) ?? [])
      if (!dist.has(e.target)) {
        dist.set(e.target, dist.get(n)! + 1);
        q.push(e.target);
      }
  }
  return null;
}

/** Binary min-heap ordered by (distance, node id) so ties resolve deterministically. */
class Heap {
  private a: [number, string][] = [];
  get size() {
    return this.a.length;
  }
  private lt(x: [number, string], y: [number, string]) {
    return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
  }
  push(x: [number, string]) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.lt(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.a,
      top = a[0],
      last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        let m = i;
        const l = 2 * i + 1,
          r = l + 1;
        if (l < a.length && this.lt(a[l], a[m])) m = l;
        if (r < a.length && this.lt(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Dijkstra with a binary heap, O((V + E) log V). Banned nodes/edges support Yen's algorithm. */
export function dijkstra(
  adj: Adj,
  src: string,
  dst: string,
  bannedNodes = new Set<string>(),
  bannedEdges = new Set<string>(),
): Route | null {
  const dist = new Map([[src, 0]]),
    prev = new Map<string, PathEdge>(),
    done = new Set<string>(),
    h = new Heap();
  h.push([0, src]);
  let reached = false;
  while (h.size) {
    const [d, u] = h.pop()!;
    if (done.has(u)) continue;
    if (u === dst) {
      reached = true;
      break;
    }
    done.add(u);
    for (const e of adj.get(u) ?? []) {
      if (
        bannedEdges.has(e.key) ||
        bannedNodes.has(e.target) ||
        done.has(e.target)
      )
        continue;
      const nd = d + edgeCost(e),
        cur = dist.get(e.target);
      if (cur === undefined || nd < cur - 1e-12) {
        dist.set(e.target, nd);
        prev.set(e.target, e);
        h.push([nd, e.target]);
      }
    }
  }
  if (!reached) return null;
  const edges: PathEdge[] = [];
  for (let n = dst; n !== src;) {
    const e = prev.get(n)!;
    edges.unshift(e);
    n = e.source;
  }
  return {
    nodes: [src, ...edges.map((e) => e.target)],
    edges,
    cost: dist.get(dst)!,
  };
}

/** Yen's algorithm: the K loopless routes with the lowest total cost between two nodes. */
export function kShortestRoutes(
  adj: Adj,
  src: string,
  dst: string,
  K = TOP_K,
): Route[] {
  const first = dijkstra(adj, src, dst);
  if (!first) return [];
  const A = [first],
    B: Route[] = [];
  for (let k = 1; k < K; k++) {
    const prev = A[k - 1];
    for (let i = 0; i < prev.edges.length; i++) {
      const rootEdges = prev.edges.slice(0, i),
        rootKeys = sig(rootEdges);
      const bannedEdges = new Set(
        A.filter(
          (p) => p.edges.length > i && sig(p.edges.slice(0, i)) === rootKeys,
        ).map((p) => p.edges[i].key),
      );
      const spur = dijkstra(
        adj,
        prev.nodes[i],
        dst,
        new Set(prev.nodes.slice(0, i)),
        bannedEdges,
      );
      if (!spur) continue;
      const edges = [...rootEdges, ...spur.edges];
      if ([...A, ...B].some((p) => sig(p.edges) === sig(edges))) continue;
      B.push({
        nodes: [prev.nodes[0], ...edges.map((e) => e.target)],
        edges,
        cost: edges.reduce((s, e) => s + edgeCost(e), 0),
      });
    }
    if (!B.length) break;
    B.sort(
      (a, b) => a.cost - b.cost || sig(a.edges).localeCompare(sig(b.edges)),
    );
    A.push(B.shift()!);
  }
  return A;
}

/** DFS enumerates simple entry->target paths (<= maxDepth edges, capped at maxPaths); BFS and Yen's annotate each with hop and likelihood rank. */
export function findAttackPathsEx(
  g: SecurityGraph,
  maxDepth = 8,
  maxPaths = MAX_PATHS,
) {
  const adj = adjacency(g),
    targets = new Set(findTargets(g));
  const found: Omit<AttackPath, "id" | "cost" | "likelihood" | "costRank">[] =
    [];
  const ranks = new Map<string, number>();
  let truncated = false;
  for (const entry of findEntryPoints(g)) {
    const nodes = [entry],
      edges: PathEdge[] = [],
      seen = new Set(nodes);
    const hops = new Map<string, number | null>();
    const dfs = (n: string) => {
      if (edges.length >= maxDepth || truncated) return;
      for (const e of adj.get(n) ?? []) {
        if (seen.has(e.target)) continue;
        nodes.push(e.target);
        seen.add(e.target);
        edges.push(e);
        if (targets.has(e.target)) {
          if (found.length >= maxPaths) truncated = true;
          else {
            if (!hops.has(e.target))
              hops.set(e.target, shortestHops(adj, entry, e.target));
            found.push({
              entryPoint: entry,
              target: e.target,
              nodes: [...nodes],
              edges: [...edges],
              isShortest: hops.get(e.target) === edges.length,
            });
          }
        }
        dfs(e.target);
        nodes.pop();
        seen.delete(e.target);
        edges.pop();
        if (truncated) return;
      }
    };
    dfs(entry);
    for (const t of targets)
      kShortestRoutes(adj, entry, t).forEach((r, i) =>
        ranks.set(sig(r.edges), i + 1),
      );
  }
  found.sort(
    (a, b) =>
      a.entryPoint.localeCompare(b.entryPoint) ||
      a.target.localeCompare(b.target) ||
      a.nodes.length - b.nodes.length ||
      a.nodes.join(">").localeCompare(b.nodes.join(">")),
  );
  const paths: AttackPath[] = found.map((p, i) => {
    const cost =
      Math.round(p.edges.reduce((s, e) => s + edgeCost(e), 0) * 1e6) / 1e6;
    return {
      id: `AP-${String(i + 1).padStart(3, "0")}`,
      ...p,
      cost,
      likelihood: Math.round(Math.exp(-cost) * 1000) / 1000,
      costRank: ranks.get(sig(p.edges)) ?? null,
    };
  });
  return { paths, truncated };
}
export const findAttackPaths = (g: SecurityGraph, maxDepth = 8) =>
  findAttackPathsEx(g, maxDepth).paths;
