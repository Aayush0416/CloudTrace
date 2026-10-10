import { ingressOf, openPortsOf, sgsOf, type Environment, type Resource } from "../parser";

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export interface Finding {
  ruleId: string;
  resourceId: string;
  title: string;
  severity: Severity;
  description: string;
}
export interface Rule {
  id: string;
  category: "network" | "iam" | "storage" | "secrets" | "database";
  check(
    r: Resource,
    env: Environment,
  ): Omit<Finding, "ruleId" | "resourceId"> | null;
}

const EMPTY = { properties: {} } as Resource;
const byId = (env: Environment, id: string) =>
  env.resources.find((r) => r.id === id) ?? EMPTY;
const isHigh = (c: string) => c === "high" || c === "critical";

export const RULES: Rule[] = [
  {
    id: "NET-001",
    category: "network",
    check: (r) =>
      r.type === "compute" && r.public
        ? {
            title: "Publicly exposed compute instance",
            severity: "medium",
            description: `${r.name} is reachable from the internet.`,
          }
        : null,
  },
  {
    id: "NET-002",
    category: "network",
    check: (r) =>
      r.type === "api" && r.public
        ? {
            title: "Public API endpoint",
            severity: "medium",
            description: `${r.name} is exposed to the internet.`,
          }
        : null,
  },
  {
    id: "NET-003",
    category: "network",
    check: (r, env) => {
      const sgPorts = sgsOf(r)
        .flatMap((id) => ingressOf(byId(env, id)))
        .filter((i) => i.source === "internet")
        .map((i) => i.port);
      const ports = [...openPortsOf(r), ...sgPorts].filter(
        (p) => p === 22 || p === 3389,
      );
      return r.public && ports.length
        ? {
            title: "Open management access from internet",
            severity: "high",
            description: `${r.name} exposes management ports (${[...new Set(ports)].join(", ")}) publicly.`,
          }
        : null;
    },
  },
  {
    id: "IAM-001",
    category: "iam",
    check: (r) =>
      r.type === "identity" && r.permissions.some((p) => p.action === "admin")
        ? {
            title: "Privileged identity with admin permissions",
            severity: "high",
            description: `${r.name} holds admin-level access.`,
          }
        : null,
  },
  {
    id: "IAM-002",
    category: "iam",
    check: (r, env) => {
      const t =
        r.type === "identity"
          ? r.permissions.filter(
              (p) =>
                p.action === "write" && isHigh(byId(env, p.target).criticality),
            )
          : [];
      return t.length
        ? {
            title: "Excessive write access to sensitive resources",
            severity: "medium",
            description: `${r.name} can write to ${t.map((p) => p.target).join(", ")}.`,
          }
        : null;
    },
  },
  {
    id: "STO-001",
    category: "storage",
    check: (r) =>
      r.type === "storage" && r.public
        ? {
            title: "Public storage bucket",
            severity: isHigh(r.criticality) ? "critical" : "high",
            description: `${r.name} is publicly accessible.`,
          }
        : null,
  },
  {
    id: "SEC-001",
    category: "secrets",
    check: (r, env) => {
      const t =
        r.type === "identity"
          ? r.permissions.filter((p) => byId(env, p.target).type === "secret")
          : [];
      return t.length
        ? {
            title: "Identity can access secret",
            severity: "medium",
            description: `${r.name} can access ${t.map((p) => p.target).join(", ")}.`,
          }
        : null;
    },
  },
  {
    id: "DB-001",
    category: "database",
    check: (r) =>
      r.type === "database" && r.public
        ? {
            title: "Publicly accessible database",
            severity: "critical",
            description: `${r.name} is exposed to the internet.`,
          }
        : null,
  },
  {
    id: "NET-004",
    category: "network",
    check: (r) => {
      const open =
        r.subtype === "security_group"
          ? ingressOf(r).filter(
              (i) => i.source === "internet" && ![80, 443].includes(i.port),
            )
          : [];
      return open.length
        ? {
            title: "Security group exposes non-web ports to the internet",
            severity: open.some((i) => i.port === 22 || i.port === 3389)
              ? "high"
              : "medium",
            description: `${r.name} allows internet ingress on port ${open.map((i) => i.port).join(", ")}.`,
          }
        : null;
    },
  },
  {
    id: "NET-005",
    category: "database",
    check: (r, env) => {
      if (r.type !== "database") return null;
      const viaPublic = sgsOf(r)
        .flatMap((id) => ingressOf(byId(env, id)))
        .some(
          (i) =>
            i.source !== "internet" &&
            env.resources.some((x) => x.public && sgsOf(x).includes(i.source)),
        );
      return viaPublic
        ? {
            title: "Database reachable from an internet-facing workload",
            severity: "high",
            description: `${r.name} accepts connections from a security group used by a public workload.`,
          }
        : null;
    },
  },
  {
    id: "IAM-003",
    category: "iam",
    check: (r, env) =>
      r.type === "identity" &&
      r.relationships.some(
        (x) =>
          (x.type === "assumes" || x.type === "trusts") &&
          byId(env, x.target).permissions.some((p) => p.action === "admin"),
      )
        ? {
            title: "Role chain leads to an admin role",
            severity: "high",
            description: `${r.name} can assume a role with admin access.`,
          }
        : null,
  },
  {
    id: "IAM-004",
    category: "iam",
    check: (r) =>
      r.type === "identity" && r.properties.compromised === true
        ? {
            title: "Identity with exposed credentials",
            severity: "critical",
            description: `${r.name} is flagged as having leaked credentials.`,
          }
        : null,
  },
];

/** Runs all rules; output order is deterministic (resource order, then rule order). */
export function evaluateRules(env: Environment): Finding[] {
  const out: Finding[] = [];
  for (const r of env.resources)
    for (const rule of RULES) {
      const f = rule.check(r, env);
      if (f) out.push({ ruleId: rule.id, resourceId: r.id, ...f });
    }
  return out;
}

/** Deterministic remediation guidance per rule. The AI layer may rephrase this but never replaces it. */
export const ADVICE: Record<string, string> = {
  "NET-001":
    "Move the instance into a private subnet, or restrict its security group to known source ranges and front it with a load balancer.",
  "NET-002":
    "Require authentication on the API and restrict access with a resource policy or WAF rules.",
  "NET-003":
    "Close SSH/RDP to the internet. Use a bastion host, VPN or SSM Session Manager instead.",
  "IAM-001":
    "Replace the admin policy with least-privilege permissions scoped to the resources this role actually needs.",
  "IAM-002":
    "Reduce write access on sensitive resources to read-only, or scope it to specific prefixes or tables.",
  "STO-001":
    "Enable block public access on the bucket and serve public content through a CDN with an origin access identity.",
  "SEC-001":
    "Limit which identities can read the secret, and scope access to a single secret ARN.",
  "DB-001":
    "Disable public accessibility and allow connections only from the application security group.",
};
Object.assign(ADVICE, {
  "NET-004":
    "Remove internet ingress on non-web ports. Allow only 80/443 through a load balancer and reach admin ports via VPN or SSM.",
  "NET-005":
    "Restrict the database security group to the specific application tier, not to groups shared with public workloads.",
  "IAM-003":
    "Limit who can assume privileged roles and require conditions (MFA, source identity) on the trust policy.",
  "IAM-004":
    "Rotate the exposed credentials immediately, revoke active sessions, and move to short-lived role-based access.",
});
