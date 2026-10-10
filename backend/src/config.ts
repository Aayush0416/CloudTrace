import "dotenv/config";
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16)
  throw new Error(
    "JWT_SECRET must be set (16+ chars). Copy .env.example to .env.",
  );
// The placeholder shipped in .env.example would let anyone forge sessions, so it is refused in production.
const PLACEHOLDER = /change-?me/i;
if (process.env.NODE_ENV === "production") {
  if (PLACEHOLDER.test(secret) || secret.length < 32)
    throw new Error(
      "JWT_SECRET is a placeholder or too short for production. Use 32+ random characters (e.g. `openssl rand -hex 32`).",
    );
} else if (PLACEHOLDER.test(secret)) {
  console.warn(
    "[config] JWT_SECRET is the example placeholder. Fine for local development, never for production.",
  );
}
const e = process.env;
export const config = {
  jwtSecret: secret,
  port: Number(e.PORT ?? 4000),
  corsOrigin: e.CORS_ORIGIN ?? "http://localhost:5173",
  appUrl: e.APP_URL ?? "http://localhost:5173",
  googleClientId: e.GOOGLE_CLIENT_ID || null,
  production: e.NODE_ENV === "production",
  /** Set TRUST_PROXY=1 (number of proxy hops) behind a reverse proxy so rate limits see real client IPs. */
  trustProxy: e.TRUST_PROXY
    ? e.TRUST_PROXY === "true"
      ? true
      : Number(e.TRUST_PROXY) || e.TRUST_PROXY
    : false,
  devAutoVerify: e.DEV_AUTO_VERIFY === "true" && e.NODE_ENV !== "production",
  aiMode: e.AI_PROVIDER === "openai" && !!e.OPENAI_API_KEY ? "llm" : "demo",
  smtp: {
    host: e.SMTP_HOST || null,
    port: Number(e.SMTP_PORT ?? 465),
    user: e.SMTP_USER,
    pass: e.SMTP_PASS,
    from: e.SMTP_FROM ?? "CloudTrace <no-reply@cloudtrace.local>",
  },
};
