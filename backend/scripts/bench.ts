import Graph from 'graphology';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { adjacency, kShortestRoutes, shortestHops } from '../src/services/attack-path';

let seed = 42;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function make(n: number) {
  const g = new Graph({ type: 'directed', multi: true });
  for (let i = 0; i < n; i++) g.addNode(`n${i}`, {});
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 5; k++) { const j = Math.min(n - 1, i + 1 + Math.floor(rnd() * 50)); g.addEdgeWithKey(`n${i}|can_access|n${j}|${k}`, `n${i}`, `n${j}`, { type: 'can_access', confidence: 0.5 + rnd() * 0.5, evidence: [] }); }
  return g;
}
const time = <T,>(f: () => T) => { const t = performance.now(); const r = f(); return [r, Math.round((performance.now() - t) * 10) / 10] as const; };
const rows = ['| Nodes | Edges | Build adjacency (ms) | BFS (ms) | Dijkstra (ms) | Yen K=5 (ms) |', '|---:|---:|---:|---:|---:|---:|'];
for (const n of [1000, 5000, 10000]) {
  const g = make(n), last = `n${n - 1}`;
  const [adj, tAdj] = time(() => adjacency(g)), [, tBfs] = time(() => shortestHops(adj, 'n0', last));
  const [, tDij] = time(() => kShortestRoutes(adj, 'n0', last, 1)), [, tYen] = time(() => kShortestRoutes(adj, 'n0', last, 5));
  rows.push(`| ${n} | ${g.size} | ${tAdj} | ${tBfs} | ${tDij} | ${tYen} |`);
}
const out = `# Algorithm benchmark\n\nSynthetic layered graphs (5 forward edges per node, random confidence), source n0 to the last node. Node ${process.version}, single run.\n\n${rows.join('\n')}\n\nDijkstra uses a binary heap: O((V + E) log V). Yen's runs up to K x path-length Dijkstra calls.\nDFS path enumeration is exponential in the worst case, so CloudTrace bounds it (depth 8, 500 paths shared between entry points, 200,000 node expansions per entry point) and reports when it truncates.\n`;
mkdirSync(join(__dirname, '../../docs'), { recursive: true });
writeFileSync(join(__dirname, '../../docs/benchmark.md'), out);
console.log(out);
