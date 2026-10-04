import type { GraphData } from "./types";
export type Dir = "LR" | "TB";
export const NODE_W = 132,
  NODE_H = 100;

/**
 * Layered (Sugiyama-style) layout.
 * 1. Layering: multi-source BFS from every node with no incoming edge (the Internet first), so depth = hops from an entry.
 * 2. Ordering: barycenter sweeps down and up (4 passes) to reduce edge crossings.
 * 3. Placement: layers on one axis, ordered nodes centered on the other.
 */
export function layoutGraph(g: GraphData, dir: Dir, keep?: Set<string>) {
  const nodes = g.nodes
    .filter((n) => !keep || keep.has(n.id))
    .map((n) => n.id)
    .sort();
  const ids = new Set(nodes),
    edges = g.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const preds = new Map<string, string[]>(),
    succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n, []);
    succs.set(n, []);
  }
  for (const e of edges) {
    succs.get(e.source)!.push(e.target);
    preds.get(e.target)!.push(e.source);
  }
  const roots = nodes
    .filter((n) => !preds.get(n)!.length)
    .sort((a, b) =>
      a === "internet" ? -1 : b === "internet" ? 1 : a.localeCompare(b),
    );
  const depth = new Map<string, number>(),
    q = [...roots];
  roots.forEach((r) => depth.set(r, 0));
  for (let i = 0; i < q.length; i++)
    for (const t of succs.get(q[i])!)
      if (!depth.has(t)) {
        depth.set(t, depth.get(q[i])! + 1);
        q.push(t);
      }
  for (const n of nodes) if (!depth.has(n)) depth.set(n, 0); // nodes only reachable through cycles
  const layers: string[][] = [];
  for (const n of nodes) (layers[depth.get(n)!] ??= []).push(n);
  const idx = new Map<string, number>();
  const reindex = () =>
    layers.forEach((l) => l.forEach((n, i) => idx.set(n, i)));
  const sweep = (d: number, nb: Map<string, string[]>) => {
    const bc = (n: string) => {
      const ns = nb.get(n)!;
      return ns.length
        ? ns.reduce((s, x) => s + idx.get(x)!, 0) / ns.length
        : idx.get(n)!;
    };
    layers[d] = [...layers[d]].sort(
      (a, b) => bc(a) - bc(b) || a.localeCompare(b),
    );
    layers[d].forEach((n, i) => idx.set(n, i));
  };
  reindex();
  for (let pass = 0; pass < 4; pass++) {
    for (let d = 1; d < layers.length; d++) sweep(d, preds);
    for (let d = layers.length - 2; d >= 0; d--) sweep(d, succs);
  }
  const pos = new Map<string, { x: number; y: number }>();
  const gapL = dir === "LR" ? NODE_W + 110 : NODE_H + 80,
    gapN = dir === "LR" ? NODE_H + 8 : NODE_W + 24;
  layers.forEach((l, d) =>
    l.forEach((n, i) => {
      const off = (i - (l.length - 1) / 2) * gapN;
      pos.set(
        n,
        dir === "LR" ? { x: d * gapL, y: off } : { x: off, y: d * gapL },
      );
    }),
  );
  return pos;
}
