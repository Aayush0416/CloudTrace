import { getProvider } from '../src/services/ai';

const ctx: any = { labels: { a: 'A' }, paths: [{ id: 'AP-001', risk: { severity: 'high', score: 50 }, nodes: ['a'], edges: [], findings: [] }], findings: [], resources: [], ranked: [] };
const path = { ...ctx.paths[0], entryPoint: 'a', target: 'a', likelihood: 0.5, costRank: 1, edges: [{ source: 'a', target: 'a', type: 'reaches', evidence: [], confidence: 0.9 }] };

describe('openai provider (mocked)', () => {
  const orig = global.fetch;
  beforeEach(() => { process.env.AI_PROVIDER = 'openai'; process.env.OPENAI_API_KEY = 'test'; });
  afterEach(() => { global.fetch = orig; delete process.env.AI_PROVIDER; delete process.env.OPENAI_API_KEY; });

  it('runs the tool loop against scan data and returns an llm reply', async () => {
    const bodies: any[] = [];
    global.fetch = jest.fn(async (_u: any, init: any) => {
      bodies.push(JSON.parse(init.body));
      const first = bodies.length === 1;
      return { ok: true, json: async () => ({ choices: [{ message: first ? { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_paths', arguments: '{}' } }] } : { role: 'assistant', content: 'AP-001 is the riskiest path.' } }] }) };
    }) as any;
    const r = await getProvider().chat('what is riskiest?', ctx);
    expect(r.mode).toBe('llm'); expect(r.references).toEqual([{ type: 'path', id: 'AP-001' }]);
    expect(bodies[1].messages.some((m: any) => m.role === 'tool' && m.content.includes('AP-001'))).toBe(true);
  });
  it('falls back to the demo engine when the API fails', async () => {
    global.fetch = jest.fn(async () => { throw new Error('network'); }) as any;
    expect((await getProvider().chat('summarize', ctx)).mode).toBe('demo');
  });
  it('rejects structured output that skips steps', async () => {
    const empty = { summary: 'x', step_explanations: [], contributing_findings: [], remediation_steps: [], assumptions: [], uncertainty: [] };
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(empty) } }] }) })) as any;
    expect((await getProvider().explainPath({ path, labels: ctx.labels })).mode).toBe('demo');
  });
});
