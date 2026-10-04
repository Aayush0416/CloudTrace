import { z } from "zod";

export const EDGE_TYPES = [
  "reaches",
  "uses",
  "assumes",
  "can_access",
  "connects_to",
  "runs_on",
  "exposed_to",
  "contains",
  "trusts",
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

const ResourceSchema = z.object({
  id: z.string().min(1),
  provider: z.string().default("aws"),
  type: z.enum([
    "compute",
    "identity",
    "storage",
    "database",
    "network",
    "secret",
    "api",
  ]),
  subtype: z.string(),
  name: z.string(),
  public: z.boolean().default(false),
  criticality: z.enum(["low", "medium", "high", "critical"]).default("low"),
  properties: z.record(z.unknown()).default({}),
  permissions: z
    .array(
      z.object({
        action: z.enum(["read", "write", "admin"]),
        target: z.string(),
      }),
    )
    .default([]),
  relationships: z
    .array(z.object({ type: z.enum(EDGE_TYPES), target: z.string() }))
    .default([]),
});
const EnvironmentSchema = z.object({
  name: z.string(),
  provider: z.string().default("aws"),
  resources: z.array(ResourceSchema).min(1),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;

export class ValidationError extends Error {
  constructor(public issues: string[]) {
    super(`Invalid environment: ${issues.join("; ")}`);
  }
}

/** Validates and normalizes a raw environment, including referential integrity. */
export function parseEnvironment(raw: unknown): Environment {
  const r = EnvironmentSchema.safeParse(raw);
  if (!r.success)
    throw new ValidationError(
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  const env = r.data;
  const ids = new Set<string>();
  const issues: string[] = [];
  for (const res of env.resources) {
    if (ids.has(res.id)) issues.push(`duplicate resource id "${res.id}"`);
    ids.add(res.id);
  }
  if (ids.has("internet")) issues.push('"internet" is a reserved id');
  for (const res of env.resources) {
    const sgs = Array.isArray(res.properties.securityGroups)
      ? (res.properties.securityGroups as string[])
      : [];
    for (const t of [...res.permissions, ...res.relationships]
      .map((x) => x.target)
      .concat(sgs))
      if (!ids.has(t))
        issues.push(`${res.id} references unknown resource "${t}"`);
  }
  if (issues.length) throw new ValidationError(issues);
  return env;
}
