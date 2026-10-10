import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';
import { layoutGraph } from '../../frontend/src/lib/graphLayout';

const dir = join(__dirname, '../../sample-data');
const HIDDEN = new Set(['vpc', 'subnet', 'security_group']);
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const build = (n: string) => {
  const r: any = analyze(JSON.parse(readFileSync(join(dir, n + '.json'), 'utf8')));
  const nodes = r.graph.nodes.filter((x: any) => !HIDDEN.has(x.subtype));
  const ids = new Set(nodes.map((x: any) => x.id));
  return { nodes, edges: r.graph.edges.filter((e: any) => !e.structural && ids.has(e.source) && ids.has(e.target)) };
};

describe.each(['LR', 'TB'] as const)('graph layout (%s)', (dir2) => {
  const main = (p: { x: number; y: number }) => (dir2 === 'LR' ? p.x : p.y);
  it.each(names)('%s: every edge points forward, nothing overlaps, no line crosses a node', (n) => {
    const g: any = build(n);
    const { pos, routes } = layoutGraph(g, dir2);
    expect(pos.size).toBe(g.nodes.length);
    for (const e of g.edges) expect(main(pos.get(e.target)!)).toBeGreaterThan(main(pos.get(e.source)!));
    const pts = [...pos.values()];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        expect(Math.abs(pts[i].x - pts[j].x) < 60 && Math.abs(pts[i].y - pts[j].y) < 60).toBe(false);
    for (const e of g.edges) {
      const line = [pos.get(e.source)!, ...(routes.get(e.id) ?? []), pos.get(e.target)!];
      for (const node of g.nodes) {
        if (node.id === e.source || node.id === e.target) continue;
        const c = pos.get(node.id)!;
        for (let i = 0; i < line.length - 1; i++)
          for (let t = 0; t <= 1; t += 0.05) {
            const x = line[i].x + (line[i + 1].x - line[i].x) * t, y = line[i].y + (line[i + 1].y - line[i].y) * t;
            expect(Math.abs(x - c.x) < 30 && Math.abs(y - c.y) < 30).toBe(false);
          }
      }
    }
  });
  it('long edges into the same resource share one trunk of lanes (enterprise)', () => {
    const g: any = build('enterprise');
    const { routes } = layoutGraph(g, dir2);
    const lateral = g.edges.filter((e: any) => e.relationship === 'connects_to' && e.target === 'rds-orders' && (routes.get(e.id)?.length ?? 0) >= 2);
    expect(lateral.length).toBeGreaterThanOrEqual(2);
    const last = lateral.map((e: any) => JSON.stringify(routes.get(e.id)!.slice(-1)[0]));
    expect(new Set(last).size).toBe(1); // they merge into the same lane before reaching the database
  });
});
