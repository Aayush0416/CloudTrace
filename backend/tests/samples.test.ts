import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { analyze } from '../src/analyze';

const dir = join(__dirname, '../../sample-data');
const load = (n: string) => JSON.parse(readFileSync(join(dir, n + '.json'), 'utf8'));
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));

describe('bundled sample environments', () => {
  it.each(names)('%s validates and analyses', (n) => {
    const r = analyze(load(n));
    expect(r.resources).toBeGreaterThan(0);
    expect(r.truncated).toBe(false);
  });
  it('browser copies match the sample-data folder', () => {
    const pub = join(__dirname, '../../frontend/public/samples');
    for (const n of names) expect(readFileSync(join(pub, n + '.json'), 'utf8')).toBe(readFileSync(join(dir, n + '.json'), 'utf8'));
  });
  it('SSRF sample has a critical path and its fixed twin has none', () => {
    const bad = analyze(load('ssrf-over-privileged-role')), good = analyze(load('ssrf-over-privileged-role-fixed'));
    expect(bad.paths.some((p) => p.risk.severity === 'critical')).toBe(true);
    expect(good.paths.some((p) => p.risk.severity === 'critical')).toBe(false);
    expect(good.paths.length).toBeLessThan(bad.paths.length + 3);
  });
  it('CI/CD sample is reachable only through the compromised identity', () => {
    const r = analyze(load('cicd-supply-chain'));
    expect(r.paths.length).toBeGreaterThan(0);
    expect(new Set(r.paths.map((p) => p.entryPoint))).toEqual(new Set(['user-ci']));
  });
  it('leaked-key sample has both internet and compromised-identity entry points', () => {
    const r = analyze(load('public-storage-and-leaked-key'));
    const entries = new Set(r.paths.map((p) => p.entryPoint));
    expect(entries.has('internet') || entries.has('user-deploy')).toBe(true);
    expect(r.findings.some((f) => f.ruleId === 'IAM-004')).toBe(true);
  });
});
