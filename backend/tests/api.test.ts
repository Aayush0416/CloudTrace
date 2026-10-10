import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.GOOGLE_CLIENT_ID = 'test-client';
delete process.env.SMTP_HOST;
delete process.env.DEV_AUTO_VERIFY;
delete process.env.AI_PROVIDER;

jest.mock('../src/db', () => require('./fakeDb'));
let googlePayload: any = {};
jest.mock('google-auth-library', () => ({
  OAuth2Client: class { verifyIdToken = async () => ({ getPayload: () => googlePayload }); },
}));

const { prisma, reset } = require('./fakeDb');
const { app } = require('../src/app');
const sample = (n: string) => JSON.parse(readFileSync(join(__dirname, '../../sample-data', n), 'utf8'));

let seq = 0;
const email = () => `user${++seq}@example.com`;
const verifiedUser = async () => {
  const e = email();
  await request(app).post('/api/auth/register').send({ name: 'Test User', email: e, password: 'password123' });
  prisma._state.users.find((u: any) => u.email === e).emailVerified = true;
  const r = await request(app).post('/api/auth/login').send({ email: e, password: 'password123' });
  return { email: e, token: r.body.token as string };
};
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeEach(() => { reset(); jest.spyOn(console, 'log').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());

describe('auth fixes', () => {
  it('Google sign-in discards a password set on a never-verified (pre-registered) account', async () => {
    const e = email();
    await request(app).post('/api/auth/register').send({ name: 'Attacker', email: e, password: 'attackerpass1' });
    googlePayload = { email: e, email_verified: true, sub: 'g-1', name: 'Victim' };
    const g = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    expect(g.status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ email: e, password: 'attackerpass1' });
    expect(login.status).toBe(401); // the attacker's password no longer works
    expect(g.body.user.hasPassword).toBe(false);
  });
  it('Google sign-in keeps the password of an already verified account', async () => {
    const { email: e } = await verifiedUser();
    googlePayload = { email: e, email_verified: true, sub: 'g-2' };
    const g = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    expect(g.body.user.hasPassword).toBe(true);
  });
  it('refuses to relink an email to a different Google account', async () => {
    const e = email();
    googlePayload = { email: e, email_verified: true, sub: 'g-3' };
    await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    googlePayload = { email: e, email_verified: true, sub: 'g-OTHER' };
    const r = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(30) });
    expect(r.status).toBe(409);
  });
  it('a simultaneous duplicate sign-up answers 409, not 500', async () => {
    const e = email();
    const orig = prisma.user.findUnique;
    prisma.user.findUnique = async () => null; // both requests saw "no such user"
    await request(app).post('/api/auth/register').send({ name: 'First', email: e, password: 'password123' });
    const r = await request(app).post('/api/auth/register').send({ name: 'Second', email: e, password: 'password123' });
    prisma.user.findUnique = orig;
    expect(r.status).toBe(409);
  });
  it('forgot/resend answer identically for known and unknown addresses', async () => {
    const { email: known } = await verifiedUser();
    for (const route of ['forgot', 'resend']) {
      const a = await request(app).post(`/api/auth/${route}`).send({ email: known });
      const b = await request(app).post(`/api/auth/${route}`).send({ email: email() });
      expect(a.status).toBe(200);
      expect(a.body).toEqual(b.body);
    }
  });
  it('limits sign-in attempts per account', async () => {
    const e = email();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await request(app).post('/api/auth/login').send({ email: e, password: 'wrong-password' })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });
  it('limits verification emails per address', async () => {
    const e = email();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await request(app).post('/api/auth/resend').send({ email: e })).status);
    expect(codes[4]).toBe(200);
    expect(codes[5]).toBe(429);
  });
});

describe('project routes', () => {
  const create = async (t: string) => (await request(app).post('/api/projects').set(auth(t)).send({ name: 'Proj', description: 'first' })).body.id as string;

  it('stores a scan summary and lists projects without loading scan results', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('enterprise.json'));
    const scan = await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    expect(scan.status).toBe(201);
    expect(prisma._state.scans[0].summary).toEqual(scan.body.summary);
    const spy = jest.spyOn(prisma.scan, 'findFirst');
    const list = await request(app).get('/api/projects').set(auth(token));
    expect(list.body[0].summary).toEqual(scan.body.summary);
    expect(spy.mock.calls.every(([a]: any) => a.select && !a.select.result)).toBe(true);
  });
  it('backfills the summary of scans created before the column existed', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('critical.json'));
    const scan = await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    prisma._state.scans[0].summary = null;
    const p = await request(app).get(`/api/projects/${id}`).set(auth(token));
    expect(p.body.summary).toEqual(scan.body.summary);
    expect(prisma._state.scans[0].summary).toEqual(scan.body.summary);
  });
  it('flags stale results after a re-import and blocks the assistant until a new scan', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('medium.json'));
    await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    expect((await request(app).get(`/api/projects/${id}`).set(auth(token))).body.stale).toBe(false);
    expect((await request(app).post(`/api/projects/${id}/assistant`).set(auth(token)).send({ question: 'summarize' })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('critical.json'));
    expect((await request(app).get(`/api/projects/${id}`).set(auth(token))).body.stale).toBe(true);
    expect((await request(app).get(`/api/projects/${id}/findings`).set(auth(token))).body.stale).toBe(true);
    expect((await request(app).post(`/api/projects/${id}/assistant`).set(auth(token)).send({ question: 'summarize' })).status).toBe(409);
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    expect((await request(app).get(`/api/projects/${id}`).set(auth(token))).body.stale).toBe(false);
  });
  it('rejects a malformed environment with 422 instead of crashing a later scan', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    const bad = { name: 'x', resources: [{ id: 'sg', type: 'network', subtype: 'security_group', name: 'sg', properties: { ingress: [null] } }] };
    const r = await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(bad);
    expect(r.status).toBe(422);
  });
  it('can clear a project description with null', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    const r = await request(app).patch(`/api/projects/${id}`).set(auth(token)).send({ description: null });
    expect(r.status).toBe(200);
    expect(r.body.description).toBeNull();
    expect((await request(app).patch(`/api/projects/${id}`).set(auth(token)).send({ name: 'Renamed' })).body.name).toBe('Renamed');
  });
  it('validates finding-state rule and resource ids', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('critical.json'));
    const put = (b: object) => request(app).put(`/api/projects/${id}/finding-states`).set(auth(token)).send(b);
    expect((await put({ ruleId: 'NOPE-1', resourceId: 'ec2-001', status: 'fixed' })).status).toBe(400);
    expect((await put({ ruleId: 'NET-001', resourceId: 'does-not-exist', status: 'fixed' })).status).toBe(400);
    expect((await put({ ruleId: 'NET-001', resourceId: 'x'.repeat(300), status: 'fixed' })).status).toBe(400);
    expect((await put({ ruleId: 'NET-001', resourceId: 'ec2-001', status: 'fixed' })).status).toBe(200);
  });
  it('records and returns an audit trail', async () => {
    const { token, email: e } = await verifiedUser();
    const id = await create(token);
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(sample('critical.json'));
    await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    const logs = (await request(app).get(`/api/projects/${id}/audit-logs`).set(auth(token))).body;
    expect(logs.map((l: any) => l.action).sort()).toEqual(['environment.import', 'project.create', 'scan.run']);
    expect(logs[0].user.email).toBe(e);
  });
  it("does not show another user's audit log", async () => {
    const a = await verifiedUser(), b = await verifiedUser();
    const id = await create(a.token);
    expect((await request(app).get(`/api/projects/${id}/audit-logs`).set(auth(b.token))).status).toBe(404);
  });
  it('the scan diff separates parallel-edge variants', async () => {
    const { token } = await verifiedUser();
    const id = await create(token);
    const env = (perms: string[]) => ({ name: 'p', resources: [
      { id: 'vm', type: 'compute', subtype: 'compute', name: 'vm', public: true, relationships: [{ type: 'uses', target: 'role' }] },
      { id: 'role', type: 'identity', subtype: 'identity', name: 'role', permissions: perms.map((a) => ({ action: a, target: 'b' })) },
      { id: 'b', type: 'storage', subtype: 'storage', name: 'b', criticality: 'critical' } ] });
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(env(['read', 'admin']));
    await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post(`/api/projects/${id}/import`).set(auth(token)).send(env(['read']));
    await request(app).post(`/api/projects/${id}/scan`).set(auth(token));
    const d = (await request(app).get(`/api/projects/${id}/diff`).set(auth(token))).body;
    expect(d.resolvedPaths).toHaveLength(1);
    expect(d.newPaths).toHaveLength(0);
    expect(d.scoreChanges).toHaveLength(0);
  });
});
