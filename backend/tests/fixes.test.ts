import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';
import { buildGraph } from '../src/services/graph';
import { findAttackPathsEx } from '../src/services/attack-path';
import { evaluateRules } from '../src/services/security-rules';
import { parseEnvironment, ValidationError, LIMITS, type Environment } from '../src/services/parser';
import { simulate, rankRemediations } from '../src/services/whatif';

const res = (id: string, type: string, extra: object = {}) => ({ id, type, subtype: type, name: id, ...extra });
const load = (n: string) => JSON.parse(readFileSync(join(__dirname, '../../sample-data', n), 'utf8'));

// one role holding read, write AND admin on the same bucket: three parallel edges, one node sequence
const parallel = { name: 'parallel', resources: [
  res('vm', 'compute', { public: true, relationships: [{ type: 'uses', target: 'role' }] }),
  res('role', 'identity', { permissions: [{ action: 'read', target: 'b' }, { action: 'write', target: 'b' }, { action: 'admin', target: 'b' }] }),
  res('b', 'storage', { criticality: 'critical' }) ] };

describe('what-if with parallel edges', () => {
  it('removing the admin permission removes exactly the admin path', () => {
    const s = simulate(parallel, { type: 'remove_permission', resourceId: 'role', target: 'b', action: 'admin' });
    expect([s.before.paths, s.after.paths]).toEqual([3, 2]);
    expect(s.removed).toHaveLength(1);
    expect(s.removed[0].severity).toBe('critical');
    expect(s.changed).toEqual([]);
    expect(s.added).toEqual([]);
  });
  it('permission removals are now ranked as remediations', () => {
    const r = rankRemediations(parallel);
    expect(r.some((x) => x.change.type === 'remove_permission')).toBe(true);
  });
  it('ranking is memoized per environment', () => expect(rankRemediations(parallel)).toBe(rankRemediations(parallel)));
});

describe('path cap and budget', () => {
  const mesh = (n: number, withLeaked = false) => {
    const rs: any[] = [];
    for (let i = 0; i < n; i++) rs.push(res(`n${i}`, 'compute', { public: i === 0, permissions: [{ action: 'read', target: 't' }],
      relationships: Array.from({ length: n }, (_, j) => j).filter((j) => j !== i).map((j) => ({ type: 'connects_to', target: `n${j}` })) }));
    rs.push(res('t', 'storage', { criticality: 'critical' }));
    if (withLeaked) rs.push(res('leaked', 'identity', { properties: { compromised: true }, permissions: [{ action: 'read', target: 't' }] }));
    return { name: 'mesh', resources: rs } as unknown as Environment;
  };
  it('a busy internet entry no longer starves a compromised identity', () => {
    const { paths, truncated } = findAttackPathsEx(buildGraph(parseEnvironment(mesh(9, true))));
    expect(truncated).toBe(true);
    expect(paths.length).toBeLessThanOrEqual(500);
    expect(paths.some((p) => p.entryPoint === 'leaked')).toBe(true);
    expect(paths.some((p) => p.entryPoint === 'internet')).toBe(true);
  });
  it('dense graphs finish quickly and report truncation', () => {
    const noTarget = mesh(24); // 24-node mesh; the bucket is reachable but the search space is astronomically large
    const t0 = Date.now();
    const out = analyze(noTarget);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(out.truncated).toBe(true);
  });
  it('small environments are unaffected', () => {
    const out = analyze(load('enterprise.json'));
    expect(out.truncated).toBe(false);
    expect(out.paths).toHaveLength(23);
  });
});

describe('input validation', () => {
  const sg = (ingress: unknown) => ({ name: 'x', resources: [
    res('sg', 'network', { subtype: 'security_group', properties: { ingress } }),
    res('vm', 'compute', { public: true, properties: { securityGroups: ['sg'] } }) ] });
  it('rejects malformed ingress rules at import', () => {
    expect(() => parseEnvironment(sg([null]))).toThrow(ValidationError);
    expect(() => parseEnvironment(sg([{ source: 'internet' }]))).toThrow(/integer port/);
    expect(() => parseEnvironment(sg('nope'))).toThrow(/must be an array/);
    expect(() => parseEnvironment(sg([{ port: 22, source: 'internet' }]))).not.toThrow();
  });
  it('rejects a non security-group id used as a security group', () => {
    const env = { name: 'x', resources: [res('a', 'compute', { properties: { securityGroups: ['b'] } }), res('b', 'storage')] };
    expect(() => parseEnvironment(env)).toThrow(/not a security_group/);
  });
  it('enforces size limits', () => {
    const many = { name: 'x', resources: Array.from({ length: LIMITS.resources + 1 }, (_, i) => res(`r${i}`, 'compute')) };
    expect(() => parseEnvironment(many)).toThrow(/at most/);
  });
  it('engine never throws on malformed data that was stored before validation existed', () => {
    const legacy = { name: 'x', provider: 'aws', resources: [
      { ...res('sg', 'network', { subtype: 'security_group' }), provider: 'aws', public: false, criticality: 'low', permissions: [], relationships: [], properties: { ingress: [null, { source: 'internet' }, { port: 22, source: 'internet' }] } },
      { ...res('vm', 'compute'), provider: 'aws', public: true, criticality: 'low', permissions: [], relationships: [], properties: { securityGroups: ['sg', 7] } } ] } as unknown as Environment;
    expect(() => { buildGraph(legacy); evaluateRules(legacy); }).not.toThrow();
  });
});

describe('MITRE mapping and choke points', () => {
  it('labels each step by its own target, not the final target', () => {
    const out = analyze(load('enterprise.json'));
    const type = new Map(out.graph.nodes.map((n) => [n.id, n.type]));
    const expected: Record<string, string> = { storage: 'T1530', secret: 'T1555.006', database: 'T1213' };
    let midChecked = 0;
    for (const p of out.paths)
      p.edges.forEach((e, i) => {
        if (e.type !== 'can_access') return;
        expect(e.mitre.id).toBe(expected[type.get(e.target)!] ?? 'T1078.004');
        if (i < p.edges.length - 1) midChecked++;
      });
    expect(midChecked).toBeGreaterThan(0); // the enterprise sample has can_access steps in the middle of a path
    const ap = out.paths.find((p) => p.edges.some((e, i) => e.source === 'role-admin' && e.target === 'secret-db-creds' && i < p.edges.length - 1))!;
    expect(ap.edges.find((e) => e.target === 'secret-db-creds')!.mitre.id).toBe('T1555.006'); // was T1213 before the fix
  });
  it('parallel permission levels do not inflate choke points', () => {
    const env = { name: 'c', resources: [
      res('vm', 'compute', { public: true, relationships: [{ type: 'uses', target: 'role' }] }),
      res('role', 'identity', { permissions: [{ action: 'read', target: 'b' }, { action: 'admin', target: 'b' }] }),
      res('b', 'storage', { criticality: 'critical' }) ] };
    const out = analyze(env);
    expect(out.paths).toHaveLength(2);
    expect(out.chokePoints).toEqual([]); // one distinct route: nothing is shared by "many" routes
  });
});

describe('production config', () => {
  const load = (env: Record<string, string>) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try { jest.isolateModules(() => { require('../src/config'); }); } finally { process.env = saved; }
  };
  it('refuses the placeholder secret in production', () => {
    expect(() => load({ NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-long-random-string' })).toThrow(/placeholder/);
  });
  it('accepts a strong secret in production', () => {
    expect(() => load({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(40) })).not.toThrow();
  });
});
