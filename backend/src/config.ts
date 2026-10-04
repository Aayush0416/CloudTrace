import "dotenv/config";
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 16)
  throw new Error(
    "JWT_SECRET must be set (16+ chars). Copy .env.example to .env.",
  );
const e = process.env;
export const config = {
  jwtSecret: secret,
  port: Number(e.PORT ?? 4000),
  corsOrigin: e.CORS_ORIGIN ?? "http://localhost:5173",
  appUrl: e.APP_URL ?? "http://localhost:5173",
  googleClientId: e.GOOGLE_CLIENT_ID || null,
  production: e.NODE_ENV === "production",
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
