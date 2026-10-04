import { readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';
const env = JSON.parse(readFileSync(join(__dirname, '../../sample-data/enterprise.json'), 'utf8'));

describe('enterprise fixture', () => {
  const r = analyze(env);
  it('has multiple entry points and many branching paths', () => {
    expect(new Set(r.paths.map(p => p.entryPoint))).toEqual(new Set(['internet', 'user-ci']));
    expect(r.paths.length).toBeGreaterThan(12);
    expect(['rds-orders', 's3-customer-data', 'kms-prod', 'secret-db-creds'].every(t => r.paths.some(p => p.target === t))).toBe(true);
  });
  it('only models attacker movement, never placement edges', () => {
    expect(r.paths.some(p => p.edges.some(e => e.type === 'runs_on' || e.type === 'contains'))).toBe(false);
    expect(r.graph.edges.some(e => e.source === 'internet' && e.target === 'ec2-web-1')).toBe(false);
  });
  it('derives lateral movement from security groups', () => {
    expect(r.graph.edges.some(e => e.source === 'alb-web' && e.target === 'ec2-web-1' && e.relationship === 'connects_to')).toBe(true);
    expect(r.graph.edges.some(e => e.source === 'bastion' && e.target === 'ec2-web-2' && e.relationship === 'connects_to')).toBe(true);
  });
  it('annotates ATT&CK techniques and choke points', () => {
    expect(r.paths.every(p => p.edges.every(e => e.mitre.id.startsWith('T')))).toBe(true);
    expect(r.chokePoints[0].paths).toBeGreaterThan(2);
  });
  it('raises the new rules', () => {
    expect(r.findings.map(f => f.ruleId)).toEqual(expect.arrayContaining(['NET-003', 'NET-004', 'NET-005', 'IAM-001', 'IAM-003', 'IAM-004']));
  });
  it('is deterministic and every target has a rank-1 route', () => {
    expect(JSON.stringify(analyze(env))).toBe(JSON.stringify(r));
    for (const key of new Set(r.paths.map(p => `${p.entryPoint}>${p.target}`))) expect(r.paths.some(p => `${p.entryPoint}>${p.target}` === key && p.costRank === 1)).toBe(true);
  });
});
