import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { config } from "./config";
import { prisma } from "./db";
import { ValidationError } from "./services/parser";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Verifies the JWT and that the session hasn't been revoked (tokenVersion bumps on password change / sign-out-everywhere). */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) throw new HttpError(401, "Sign in required");
  let payload: { sub: string; v?: number };
  try {
    payload = jwt.verify(h.slice(7), config.jwtSecret) as {
      sub: string;
      v?: number;
    };
  } catch {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  const u = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true },
  });
  if (!u || (payload.v ?? 0) !== u.tokenVersion)
    throw new HttpError(401, "Session expired. Sign in again.");
  (req as any).userId = payload.sub;
  next();
}
export const userId = (req: Request): string => (req as any).userId;

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError)
    return res
      .status(err.status)
      .json({ error: err.message, details: err.details });
  if (err instanceof ValidationError)
    return res
      .status(422)
      .json({ error: "Environment failed validation", details: err.issues });
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({
        error: "Invalid request",
        details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}

const limited = (error: string) => ({ error });
/** Per-user limiter for expensive endpoints (import, scan, what-if, remediation ranking). Must run after requireAuth. */
export const heavyLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  keyGenerator: (req) => userId(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: limited("Too many analysis requests. Try again in a few minutes."),
});
/** Credential guessing limiter: 10 attempts per 15 minutes per IP + email, so one account can't be hammered from many IPs' shared budget. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) =>
    `${req.ip}|${String(req.body?.email ?? "").toLowerCase()}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: limited("Too many sign-in attempts. Try again in 15 minutes."),
});
/** Email-sending limiter (verify/reset links): 5 per hour per target address, stops mail bombing. */
export const mailLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => String(req.body?.email ?? "").toLowerCase() || String(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: limited("Too many emails requested for this address. Try again later."),
});

/** Best-effort audit trail: a failure to write the log never fails the request. */
export async function audit(
  req: Request,
  action: string,
  projectId: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId(req),
        projectId,
        action,
        details: (details ?? undefined) as any,
      },
    });
  } catch (err) {
    console.error("audit log write failed:", err);
  }
}
