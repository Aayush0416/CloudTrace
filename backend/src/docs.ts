/** Compact OpenAPI 3 description generated from one table, served at /api/docs. [method, path, summary, needsAuth] */
const OPS: [string, string, string, boolean][] = [
  ["get", "/auth/config", "Public sign-in configuration", false],
  [
    "post",
    "/auth/register",
    "Create an account and send a verification email",
    false,
  ],
  ["post", "/auth/verify", "Verify an email with a single-use token", false],
  ["post", "/auth/resend", "Resend the verification email", false],
  ["post", "/auth/login", "Sign in with email and password", false],
  ["post", "/auth/google", "Sign in with a Google ID token", false],
  ["post", "/auth/forgot", "Request a password reset email", false],
  ["post", "/auth/reset", "Set a new password with a reset token", false],
  ["get", "/auth/me", "Current user", true],
  ["patch", "/auth/profile", "Update display name", true],
  ["post", "/auth/password", "Change or set password", true],
  ["post", "/auth/logout-all", "Revoke all other sessions", true],
  ["delete", "/auth/account", "Delete the account and its data", true],
  ["get", "/projects", "List projects", true],
  ["post", "/projects", "Create a project", true],
  ["get", "/projects/{id}", "Project details", true],
  ["patch", "/projects/{id}", "Rename a project", true],
  ["delete", "/projects/{id}", "Delete a project", true],
  ["post", "/projects/{id}/import", "Validate and store an environment", true],
  ["post", "/projects/{id}/scan", "Run the deterministic analysis", true],
  ["get", "/projects/{id}/scans", "Scan history", true],
  ["get", "/projects/{id}/resources", "Resources from the latest scan", true],
  ["get", "/projects/{id}/findings", "Findings from the latest scan", true],
  ["get", "/projects/{id}/graph", "Security graph", true],
  [
    "get",
    "/projects/{id}/attack-paths",
    "Attack paths with risk, ranks and ATT&CK mapping",
    true,
  ],
  [
    "get",
    "/projects/{id}/choke-points",
    "Nodes many attack paths pass through",
    true,
  ],
  [
    "post",
    "/projects/{id}/what-if",
    "Simulate a change on a copy of the environment",
    true,
  ],
  [
    "get",
    "/projects/{id}/remediations",
    "Changes ranked by attack paths removed",
    true,
  ],
  ["get", "/projects/{id}/diff", "Changes since the previous scan", true],
  ["get", "/projects/{id}/finding-states", "Finding workflow states", true],
  ["put", "/projects/{id}/finding-states", "Set a finding status", true],
  [
    "post",
    "/projects/{id}/attack-paths/{pathId}/explain",
    "AI explanation of a path",
    true,
  ],
  [
    "post",
    "/projects/{id}/attack-paths/{pathId}/remediation",
    "AI fix suggestions for a path",
    true,
  ],
  ["post", "/projects/{id}/assistant", "Ask the assistant", true],
];
export const spec = {
  openapi: "3.0.3",
  info: {
    title: "CloudTrace API",
    version: "0.3.0",
    description:
      "Attack path analysis. Analysis is deterministic; the AI layer only explains results.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: OPS.reduce((acc: Record<string, any>, [m, p, summary, auth]) => {
    const params = [...p.matchAll(/\{(\w+)\}/g)].map((x) => ({
      name: x[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    (acc[p] ??= {})[m] = {
      summary,
      parameters: params,
      ...(auth ? { security: [{ bearer: [] }] } : {}),
      responses: {
        "200": { description: "OK" },
        "401": { description: "Not signed in" },
      },
    };
    return acc;
  }, {}),
};
