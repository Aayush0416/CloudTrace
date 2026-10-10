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
/** Size limits keep the path search bounded: a scan must stay fast whatever is uploaded. */
export const LIMITS = { resources: 500, linksPerResource: 100 } as const;

const EnvironmentSchema = z.object({
  name: z.string(),
  provider: z.string().default("aws"),
  resources: z
    .array(ResourceSchema)
    .min(1)
    .max(LIMITS.resources, `at most ${LIMITS.resources} resources are supported`),
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;

export interface Ingress {
  port: number;
  source: string;
}
const isIngress = (x: unknown): x is Ingress =>
  !!x &&
  typeof x === "object" &&
  Number.isInteger((x as Ingress).port) &&
  (x as Ingress).port >= 0 &&
  (x as Ingress).port <= 65535 &&
  typeof (x as Ingress).source === "string" &&
  (x as Ingress).source.length > 0;

/** Well-formed security-group ingress rules of a resource. Malformed entries are ignored, never thrown on. */
export const ingressOf = (r: Pick<Resource, "properties">): Ingress[] =>
  Array.isArray(r.properties.ingress)
    ? (r.properties.ingress as unknown[]).filter(isIngress)
    : [];
/** Security-group ids attached to a resource (non-string entries ignored). */
export const sgsOf = (r: Pick<Resource, "properties">): string[] =>
  Array.isArray(r.properties.securityGroups)
    ? (r.properties.securityGroups as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];
/** Ports listed in `openPorts` (non-numbers ignored). */
export const openPortsOf = (r: Pick<Resource, "properties">): number[] =>
  Array.isArray(r.properties.openPorts)
    ? (r.properties.openPorts as unknown[]).filter(
        (x): x is number => typeof x === "number",
      )
    : [];

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
  const bySubtype = new Map(env.resources.map((r) => [r.id, r.subtype]));
  for (const res of env.resources) {
    const links = res.permissions.length + res.relationships.length;
    if (links > LIMITS.linksPerResource)
      issues.push(
        `${res.id} has ${links} permissions and relationships (maximum ${LIMITS.linksPerResource})`,
      );
    const { ingress, securityGroups, openPorts } = res.properties;
    if (ingress !== undefined) {
      if (!Array.isArray(ingress)) issues.push(`${res.id}: properties.ingress must be an array`);
      else
        ingress.forEach((x, i) => {
          if (!isIngress(x))
            issues.push(
              `${res.id}: properties.ingress[${i}] needs an integer port (0-65535) and a source`,
            );
        });
    }
    if (openPorts !== undefined) {
      if (!Array.isArray(openPorts) || openPorts.some((p) => typeof p !== "number"))
        issues.push(`${res.id}: properties.openPorts must be an array of numbers`);
    }
    if (securityGroups !== undefined) {
      if (!Array.isArray(securityGroups) || securityGroups.some((g) => typeof g !== "string"))
        issues.push(`${res.id}: properties.securityGroups must be an array of resource ids`);
      else
        for (const g of securityGroups as string[])
          if (ids.has(g) && bySubtype.get(g) !== "security_group")
            issues.push(`${res.id}: securityGroups entry "${g}" is not a security_group resource`);
    }
    for (const t of [...res.permissions, ...res.relationships]
      .map((x) => x.target)
      .concat(sgsOf(res)))
      if (!ids.has(t))
        issues.push(`${res.id} references unknown resource "${t}"`);
  }
  if (issues.length) throw new ValidationError(issues);
  return env;
}
