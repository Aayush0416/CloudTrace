import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';
import { parseEnvironment, ValidationError } from '../src/services/parser';

const load = (n: string) => JSON.parse(readFileSync(join(__dirname, '../../sample-data', n), 'utf8'));

describe('validation', () => {
  it('rejects dangling references and duplicate ids', () => {
    const bad = { name: 'x', resources: [
      { id: 'a', type: 'compute', subtype: 'ec2', name: 'a', relationships: [{ type: 'uses', target: 'ghost' }] },
      { id: 'a', type: 'storage', subtype: 's3', name: 'b' } ] };
    expect(() => parseEnvironment(bad)).toThrow(ValidationError);
  });
});

describe('fixtures', () => {
  it('safe: no attack paths', () => { expect(analyze(load('safe.json')).paths).toHaveLength(0); });

  it('medium: public compute -> role -> storage', () => {
    const r = analyze(load('medium.json'));
    expect(r.paths).toHaveLength(1);
    expect(r.paths[0].nodes).toEqual(['internet', 'ec2-001', 'role-web', 's3-data']);
    expect(r.paths[0].isShortest).toBe(true);
    expect(r.findings.map(f => f.ruleId)).toEqual(expect.arrayContaining(['NET-001', 'IAM-002']));
  });

  it('critical: public compute -> privileged role -> secret -> database', () => {
    const r = analyze(load('critical.json'));
    const toDb = r.paths.find(p => p.target === 'rds-prod')!;
    expect(toDb.nodes).toEqual(['internet', 'ec2-001', 'role-admin', 'secret-db', 'rds-prod']);
    expect(toDb.risk.severity).toBe('critical');
    expect(toDb.risk.factors.privilege).toBe(1);
    expect(r.findings.map(f => f.ruleId)).toEqual(expect.arrayContaining(['NET-003', 'IAM-001', 'SEC-001']));
  });

  it('is deterministic for identical input', () => {
    for (const f of ['safe.json', 'medium.json', 'critical.json'])
      expect(JSON.stringify(analyze(load(f)))).toBe(JSON.stringify(analyze(load(f))));
  });
});
