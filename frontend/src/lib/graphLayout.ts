import type { GraphData } from "./types";
export type Dir = "LR" | "TB";
export interface Pt {
  x: number;
  y: number;
}
/** Footprint of a node including the two-line label under it. */
export const NODE_W = 144,
  NODE_H = 96;
const DUMMY = 18; // room reserved for a line that only passes through a layer

export interface Layout {
  /** Centre of every node. */
  pos: Map<string, Pt>;
  /** For edges that skip layers: the lane centres the line passes through, in order from source to target. */
  routes: Map<string, Pt[]>;
}

/**
 * Layered (Sugiyama-style) layout where every edge points forward and long edges are routed in their own lanes.
 *
 * 1. Cycle removal: depth-first search from the roots; an edge that closes a cycle is treated as reversed for layering.
 * 2. Layering: longest path from the roots, so a node always sits to the right of everything that leads to it
 *    (the previous breadth-first layering put a node next to its nearest parent, which made lines run backwards).
 * 3. Long edges get one invisible "lane" node in each layer they cross, so they take part in ordering and never pass through real nodes.
 * 4. Ordering: barycenter sweeps down and up to reduce crossings.
 * 5. Placement: iterated neighbour averaging with minimum spacing (forward and backward fix, then averaged), which straightens lines
 *    and keeps lanes compact. Layers are then positioned on the main axis.
 */
export function layoutGraph(
  g: GraphData,
  dir: Dir,
  keep?: Set<string>,
): Layout {
  const nodes = g.nodes
    .filter((n) => !keep || keep.has(n.id))
    .map((n) => n.id)
    .sort();
  const ids = new Set(nodes);
  const edges = g.edges
    .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
    .sort((a, b) => a.id.localeCompare(b.id));

  // ---- 1. cycle removal -------------------------------------------------
  const out = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) out.get(e.source)!.push(e.target);
  const hasIn = new Set(edges.map((e) => e.target));
  const roots = nodes
    .filter((n) => !hasIn.has(n))
    .sort((a, b) =>
      a === "internet" ? -1 : b === "internet" ? 1 : a.localeCompare(b),
    );
  const state = new Map<string, 0 | 1 | 2>(); // 1 = on stack, 2 = done
  const back = new Set<string>(); // "source>target" pairs that close a cycle
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      const s = state.get(v);
      if (s === 1) back.add(`${u}>${v}`);
      else if (!s) visit(v);
    }
    state.set(u, 2);
  };
  for (const r of roots) if (!state.has(r)) visit(r);
  for (const n of nodes) if (!state.has(n)) visit(n); // components that are pure cycles

  // effective (forward) direction of every edge
  interface E {
    id: string;
    from: string;
    to: string;
    reversed: boolean;
  }
  const eff: E[] = edges.map((e) => {
    const r = back.has(`${e.source}>${e.target}`);
    return { id: e.id, from: r ? e.target : e.source, to: r ? e.source : e.target, reversed: r };
  });

  // ---- 2. longest-path layering ----------------------------------------
  const preds = new Map<string, string[]>(nodes.map((n) => [n, []])),
    succs = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of eff) {
    succs.get(e.from)!.push(e.to);
    preds.get(e.to)!.push(e.from);
  }
  const indeg = new Map(nodes.map((n) => [n, preds.get(n)!.length]));
  const layer = new Map<string, number>();
  const queue = nodes.filter((n) => indeg.get(n) === 0);
  queue.forEach((n) => layer.set(n, 0));
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    for (const v of succs.get(u)!) {
      layer.set(v, Math.max(layer.get(v) ?? 0, layer.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  for (const n of nodes) if (!layer.has(n)) layer.set(n, 0);

  // ---- 3. lane nodes for edges that skip layers ------------------------
  // Long edges of the same kind that end at the same resource (for example four lateral-movement lines into one database)
  // share one trunk of lanes, so they merge into a single line instead of fanning across the drawing.
  const relOf = new Map(edges.map((e) => [e.id, e.relationship as string]));
  const bundle = new Map<string, E[]>();
  for (const e of eff) {
    if (e.reversed || layer.get(e.to)! - layer.get(e.from)! < 2) continue;
    const k = `${e.to}|${relOf.get(e.id)}`;
    (bundle.get(k) ?? bundle.set(k, []).get(k)!).push(e);
  }
  const bundled = new Map<string, string>(); // edge id -> bundle key
  for (const [k, list] of bundle) if (list.length >= 2) list.forEach((e) => bundled.set(e.id, k));

  const lanes = new Map<string, string[]>(); // edge id -> lane ids from `from` to `to`
  const layerOf = new Map(layer);
  const isDummy = new Set<string>();
  const all = [...nodes];
  const dPreds = new Map<string, string[]>(nodes.map((n) => [n, []])),
    dSuccs = new Map<string, string[]>(nodes.map((n) => [n, []]));
  const link = (x: string, y: string) => {
    if (dSuccs.get(x)!.includes(y)) return;
    dSuccs.get(x)!.push(y);
    dPreds.get(y)!.push(x);
  };
  const lane = (id: string, l: number) => {
    if (!isDummy.has(id)) {
      isDummy.add(id);
      layerOf.set(id, l);
      all.push(id);
      dPreds.set(id, []);
      dSuccs.set(id, []);
    }
    return id;
  };
  for (const e of eff) {
    const a = layer.get(e.from)!,
      b = layer.get(e.to)!,
      bk = bundled.get(e.id);
    let prev = e.from;
    const chain: string[] = [];
    for (let l = a + 1; l < b; l++) {
      const d = lane(bk ? `~b~${bk}~${l}` : `~${e.id}~${l}`, l);
      link(prev, d);
      chain.push(d);
      prev = d;
    }
    link(prev, e.to);
    lanes.set(e.id, chain);
  }

  const layers: string[][] = [];
  for (const n of all) (layers[layerOf.get(n)!] ??= []).push(n);
  for (let i = 0; i < layers.length; i++) layers[i] ??= [];

  // ---- 4. crossing reduction -------------------------------------------
  // Barycenter sweeps plus adjacent swaps, from two different starting orders; the arrangement with fewest crossings wins.
  const idx = new Map<string, number>();
  const reindex = (l: string[]) => l.forEach((n, i) => idx.set(n, i));
  const pairsBetween = (d: number) => {
    const out: [string, string][] = [];
    for (const u of layers[d] ?? []) for (const v of dSuccs.get(u)!) out.push([u, v]);
    return out;
  };
  // Crossings between layer d and d+1 = inversions among the edges ordered by upper position, counted with a Fenwick tree.
  const crossingsAt = (d: number) => {
    if (d < 0 || d >= layers.length - 1) return 0;
    const p = pairsBetween(d)
      .map(([u, v]) => [idx.get(u)!, idx.get(v)!] as [number, number])
      .sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const m = layers[d + 1].length,
      bit = new Array<number>(m + 1).fill(0);
    let c = 0,
      seen = 0;
    for (const [, v] of p) {
      let le = 0;
      for (let i = v + 1; i > 0; i -= i & -i) le += bit[i];
      c += seen - le;
      for (let i = v + 1; i <= m; i += i & -i) bit[i]++;
      seen++;
    }
    return c;
  };
  const totalCrossings = () => layers.reduce((s, _, d) => s + crossingsAt(d), 0);
  const sweep = (d: number, nb: Map<string, string[]>) => {
    const bc = (n: string) => {
      const ns = nb.get(n)!;
      return ns.length ? ns.reduce((s, x) => s + idx.get(x)!, 0) / ns.length : idx.get(n)!;
    };
    layers[d] = [...layers[d]].sort((a, b) => bc(a) - bc(b) || a.localeCompare(b));
    reindex(layers[d]);
  };
  // Crossings that exist between the edges of u (placed left) and the edges of v (placed right), on both sides.
  const between = (u: string, v: string) => {
    let c = 0;
    for (const nb of [dPreds, dSuccs])
      for (const x of nb.get(u)!) for (const y of nb.get(v)!) if (idx.get(x)! > idx.get(y)!) c++;
    return c;
  };
  const transpose = () => {
    for (let round = 0; round < 8; round++) {
      let improved = false;
      for (const l of layers)
        for (let i = 0; i < l.length - 1; i++)
          if (between(l[i + 1], l[i]) < between(l[i], l[i + 1])) {
            [l[i], l[i + 1]] = [l[i + 1], l[i]];
            idx.set(l[i], i);
            idx.set(l[i + 1], i + 1);
            improved = true;
          }
      if (!improved) break;
    }
  };
  // starting order 2: depth-first from the roots keeps connected nodes together
  const dfsOrder = () => {
    const seen = new Set<string>(),
      rank = new Map<string, number>();
    const go = (u: string) => {
      if (seen.has(u)) return;
      seen.add(u);
      rank.set(u, rank.size);
      for (const v of [...dSuccs.get(u)!].sort()) go(v);
    };
    for (const r of roots) go(r);
    for (const n of all) go(n);
    return layers.map((l) => [...l].sort((a, b) => rank.get(a)! - rank.get(b)!));
  };
  const big = all.length > 400; // very large drawings: one start and fewer sweeps keep the layout interactive
  const starts: string[][][] = big
    ? [dfsOrder()]
    : [layers.map((l) => [...l]), dfsOrder()];
  let best: string[][] = starts[0],
    bestC = Infinity;
  for (const st of starts) {
    st.forEach((l, i) => (layers[i] = [...l]));
    layers.forEach(reindex);
    for (let pass = 0; pass < (big ? 4 : 10); pass++) {
      for (let d = 1; d < layers.length; d++) sweep(d, dPreds);
      for (let d = layers.length - 2; d >= 0; d--) sweep(d, dSuccs);
    }
    transpose();
    const c = totalCrossings();
    if (c < bestC) {
      bestC = c;
      best = layers.map((l) => [...l]);
    }
  }
  best.forEach((l, i) => (layers[i] = l));
  layers.forEach(reindex);

  // ---- 5. placement along the cross axis -------------------------------
  const along = dir === "LR" ? NODE_H : NODE_W; // footprint of a real node on the cross axis
  const size = (n: string) => (isDummy.has(n) ? DUMMY : along);
  const gap = (a: string, b: string) => (size(a) + size(b)) / 2;
  const cross = new Map<string, number>();
  layers.forEach((l) => {
    let y = 0;
    l.forEach((n, i) => {
      if (i) y += gap(l[i - 1], n);
      cross.set(n, y);
    });
    const mid = (cross.get(l[l.length - 1]) ?? 0) / 2;
    l.forEach((n) => cross.set(n, cross.get(n)! - mid));
  });
  const settle = (l: string[], want: (n: string) => number) => {
    if (!l.length) return;
    const d = l.map(want);
    const a = [...d],
      b = [...d];
    for (let i = 1; i < l.length; i++) a[i] = Math.max(d[i], a[i - 1] + gap(l[i - 1], l[i]));
    for (let i = l.length - 2; i >= 0; i--) b[i] = Math.min(d[i], b[i + 1] - gap(l[i], l[i + 1]));
    l.forEach((n, i) => cross.set(n, (a[i] + b[i]) / 2));
  };
  const avg = (n: string, nb: Map<string, string[]>) => {
    const ns = nb.get(n)!;
    return ns.length ? ns.reduce((s, x) => s + cross.get(x)!, 0) / ns.length : cross.get(n)!;
  };
  // A lane (invisible stop of a long edge) looks best on the straight line between its neighbours, so it is pulled by both sides.
  const both = (n: string) => {
    const ns = [...dPreds.get(n)!, ...dSuccs.get(n)!];
    return ns.length ? ns.reduce((s, x) => s + cross.get(x)!, 0) / ns.length : cross.get(n)!;
  };
  const down = () => {
    for (let d = 1; d < layers.length; d++)
      settle(layers[d], (n) => (isDummy.has(n) ? both(n) : avg(n, dPreds)));
  };
  const up = () => {
    for (let d = layers.length - 2; d >= 0; d--)
      settle(layers[d], (n) => (isDummy.has(n) ? both(n) : avg(n, dSuccs)));
  };
  for (let it = 0; it < 10; it++) {
    down();
    up();
  }
  // Final answer: the mean of a downward and an upward pass (both keep the minimum spacing, so their mean does too).
  down();
  const fromTop = new Map(cross);
  up();
  for (const [n, y] of fromTop) cross.set(n, (y + cross.get(n)!) / 2);
  // centre the whole drawing on the cross axis
  const vals = [...cross.values()];
  const shift = vals.length ? (Math.min(...vals) + Math.max(...vals)) / 2 : 0;

  // ---- 6. coordinates ---------------------------------------------------
  const step = dir === "LR" ? NODE_W + 120 : NODE_H + 90;
  const at = (n: string): Pt => {
    const main = layerOf.get(n)! * step,
      c = cross.get(n)! - shift;
    return dir === "LR" ? { x: main, y: c } : { x: c, y: main };
  };
  const pos = new Map<string, Pt>();
  for (const n of nodes) pos.set(n, at(n));
  const routes = new Map<string, Pt[]>();
  for (const e of eff) {
    const pts = lanes.get(e.id)!.map(at);
    routes.set(e.id, e.reversed ? pts.reverse() : pts);
  }
  return { pos, routes };
}
