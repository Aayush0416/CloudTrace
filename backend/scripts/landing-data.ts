import { readFileSync, writeFileSync } from 'fs';
import { analyze } from '../src/analyze';

/** Bakes the enterprise analysis into the landing page so its graph preview is the real component on real data. */
const env = JSON.parse(readFileSync('../sample-data/enterprise.json', 'utf8')), r = analyze(env);
const HIDDEN = new Set(['vpc', 'subnet', 'security_group']);
const nodes = r.graph.nodes.filter(n => !HIDDEN.has(n.subtype)), ids = new Set(nodes.map(n => n.id));
const out = {
  graph: { nodes, edges: r.graph.edges.filter(e => !e.structural && ids.has(e.source) && ids.has(e.target)) },
  resources: env.resources.map((x: any) => ({ id: x.id, name: x.name, type: x.type, subtype: x.subtype, public: !!x.public, criticality: x.criticality ?? 'low', findingCount: 0, pathCount: 0 })),
  paths: r.paths.map(p => ({ id: p.id, entryPoint: p.entryPoint, target: p.target, nodes: p.nodes, edges: p.edges.map(e => ({ key: e.key, source: e.source, target: e.target, type: e.type })), risk: { severity: p.risk.severity, score: p.risk.score } })),
  chokePoints: r.chokePoints,
};
writeFileSync('../frontend/src/features/landing/sample.json', JSON.stringify(out));
console.log(`wrote ${out.paths.length} paths, ${out.graph.nodes.length} nodes, ${out.graph.edges.length} edges`);
