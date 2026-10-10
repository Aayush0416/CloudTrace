/** Minimal in-memory stand-in for the Prisma client, just enough for the API tests (no Postgres needed). */
let n = 0;
const id = () => `id${++n}`;
type Row = Record<string, any>;
const state = {
  users: [] as Row[], projects: [] as Row[], scans: [] as Row[],
  logs: [] as Row[], states: [] as Row[],
};
export const reset = () => { for (const k of Object.keys(state)) (state as any)[k] = []; };
const uniq = (code = 'P2002') => Object.assign(new Error('Unique constraint failed'), { code });
const pick = (row: Row | undefined, select?: Row) => {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
};
const apply = (row: Row, data: Row) => {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] ?? 0) + v.increment;
    else if (v !== undefined) row[k] = v;
  }
  return { ...row };
};
const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([k, v]) =>
    v && typeof v === 'object' && !(v instanceof Date)
      ? ('gt' in v ? row[k] > v.gt : true)
      : row[k] === v);
const findMany = (rows: Row[], where?: Row, orderBy?: Row) => {
  let out = rows.filter((r) => matches(r, where));
  if (orderBy) {
    const [k, dir] = Object.entries(orderBy)[0] as [string, string];
    out = [...out].sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  return out;
};
const byKey = (rows: Row[], where: Row) => rows.find((r) => matches(r, where));

export const prisma = {
  user: {
    findUnique: async ({ where }: Row) => pick(byKey(state.users, where)),
    findFirst: async ({ where }: Row) => pick(byKey(state.users, where)),
    create: async ({ data }: Row) => {
      if (state.users.some((u) => u.email === data.email)) throw uniq();
      const row = { id: id(), emailVerified: false, tokenVersion: 0, passwordHash: null, googleId: null, createdAt: new Date(), ...data };
      state.users.push(row);
      return { ...row };
    },
    update: async ({ where, data }: Row) => apply(byKey(state.users, where)!, data),
    delete: async ({ where }: Row) => { state.users = state.users.filter((u) => !matches(u, where)); },
  },
  project: {
    findFirst: async ({ where }: Row) => pick(byKey(state.projects, where)),
    findMany: async ({ where, orderBy }: Row) => findMany(state.projects, where, orderBy).map((r) => ({ ...r })),
    create: async ({ data }: Row) => {
      const row = { id: id(), description: null, provider: 'aws', environment: null, environmentUpdatedAt: null, createdAt: new Date(), ...data };
      state.projects.push(row);
      return { ...row };
    },
    update: async ({ where, data }: Row) => apply(byKey(state.projects, where)!, data),
    delete: async ({ where }: Row) => {
      state.projects = state.projects.filter((p) => !matches(p, where));
    },
  },
  scan: {
    findFirst: async ({ where, orderBy, select }: Row) => pick(findMany(state.scans, where, orderBy)[0], select),
    findUnique: async ({ where, select }: Row) => pick(byKey(state.scans, where), select),
    findMany: async ({ where, orderBy, select, take }: Row) =>
      findMany(state.scans, where, orderBy).slice(0, take ?? 1e9).map((r) => pick(r, select)),
    create: async ({ data }: Row) => {
      const row = { id: id(), status: 'completed', source: 'json_import', summary: null, error: null, startedAt: new Date(), ...data };
      state.scans.push(row);
      return { ...row };
    },
    update: async ({ where, data }: Row) => apply(byKey(state.scans, where)!, data),
  },
  auditLog: {
    create: async ({ data }: Row) => { const row = { id: id(), createdAt: new Date(), ...data }; state.logs.push(row); return row; },
    findMany: async ({ where, orderBy, take }: Row) =>
      findMany(state.logs, where, orderBy).slice(0, take ?? 1e9).map((l) => {
        const u = state.users.find((x) => x.id === l.userId);
        return { ...l, user: { email: u?.email, name: u?.name } };
      }),
  },
  findingState: {
    findMany: async ({ where }: Row) => findMany(state.states, where),
    upsert: async ({ where, create, update }: Row) => {
      const w = where.projectId_ruleId_resourceId;
      const row = state.states.find((s) => s.projectId === w.projectId && s.ruleId === w.ruleId && s.resourceId === w.resourceId);
      if (row) return apply(row, update);
      const made = { id: id(), updatedAt: new Date(), ...create };
      state.states.push(made);
      return made;
    },
  },
  _state: state,
};
