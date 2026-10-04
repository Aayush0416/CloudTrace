import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';
import { simulate, rankRemediations } from '../src/services/whatif';
import { getProvider } from '../src/services/ai';

const load = (n: string) => JSON.parse(readFileSync(join(__dirname, '../../sample-data', n), 'utf8'));
const res = (id: string, type: string, extra: object = {}) => ({ id, type, subtype: type, name: id, ...extra });
// two routes to s3: short (via role-a) and long (via role-b -> role-c)
const diamond = { name: 'diamond', resources: [
  res('ec2', 'compute', { public: true, relationships: [{ type: 'uses', target: 'role-a' }, { type: 'uses', target: 'role-b' }] }),
  res('role-a', 'identity', { permissions: [{ action: 'read', target: 's3' }] }),
  res('role-b', 'identity', { relationships: [{ type: 'trusts', target: 'role-c' }] }),
  res('role-c', 'identity', { permissions: [{ action: 'read', target: 's3' }] }),
  res('s3', 'storage', { criticality: 'high' }) ] };

describe('graph algorithms', () => {
  const r = analyze(diamond);
  it('DFS finds every route', () => expect(r.paths.map(p => p.nodes.join('>')).sort()).toEqual(['internet>ec2>role-a>s3', 'internet>ec2>role-b>role-c>s3']));
  it("Yen's ranks the cheaper route first", () => {
    const short = r.paths.find(p => p.nodes.includes('role-a'))!, long = r.paths.find(p => p.nodes.includes('role-c'))!;
    expect([short.costRank, long.costRank]).toEqual([1, 2]);
    expect(short.cost).toBeLessThan(long.cost);
    expect(short.isShortest).toBe(true); expect(long.isShortest).toBe(false);
  });
});

describe('what-if', () => {
  it('making the entry resource private removes every path', () => {
    const s = simulate(load('critical.json'), { type: 'make_private', resourceId: 'ec2-001' });
    expect(s.after.paths).toBe(0); expect(s.removed).toHaveLength(2); expect(s.targetsProtected).toContain('rds-prod');
  });
  it('does not mutate the original and rejects no-op changes', () => {
    const env = load('critical.json'); const copy = JSON.stringify(env);
    simulate(env, { type: 'make_private', resourceId: 'ec2-001' });
    expect(JSON.stringify(env)).toBe(copy);
    expect(() => simulate(env, { type: 'make_private', resourceId: 'rds-prod' })).toThrow();
  });
  it('ranks path-breaking changes', () => { expect(rankRemediations(load('critical.json'))[0].pathsRemoved).toBe(2); });
});

describe('demo AI', () => {
  const r = analyze(load('critical.json')), labels = Object.fromEntries(r.graph.nodes.map(n => [n.id, n.label]));
  it('explains a path using only supplied facts', async () => {
    const out = await getProvider().explainPath({ path: r.paths[0], labels });
    expect(out.mode).toBe('demo'); expect(out.step_explanations).toHaveLength(r.paths[0].edges.length);
    expect(out.step_explanations[0].explanation).toContain('web-server');
  });
  it('answers chat questions from scan data', async () => {
    const ranked = rankRemediations(load('critical.json'));
    const reply = await getProvider().chat('what should I fix first?', { labels, paths: r.paths, findings: r.findings, resources: [], ranked });
    expect(reply.answer).toContain(ranked[0].label);
  });
});
