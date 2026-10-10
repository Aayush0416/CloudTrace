import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { prisma } from "../db";
import { config } from "../config";
import {
  HttpError,
  loginLimiter,
  mailLimiter,
  requireAuth,
  userId,
} from "../middleware";
import { mailConfigured, sendMail } from "../services/mailer";

const r = Router();
/** Compared against when the email is unknown, so response time does not reveal whether an account exists. */
const DUMMY_HASH = bcrypt.hashSync("cloudtrace-dummy-password", 12);
const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
type U = {
  id: string;
  name: string;
  email: string;
  tokenVersion: number;
  emailVerified: boolean;
  passwordHash: string | null;
  googleId: string | null;
  createdAt: Date;
};
const pub = (u: U) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  emailVerified: u.emailVerified,
  hasPassword: !!u.passwordHash,
  googleLinked: !!u.googleId,
  createdAt: u.createdAt,
});
const issue = (u: U) => ({
  token: jwt.sign({ sub: u.id, v: u.tokenVersion }, config.jwtSecret, {
    expiresIn: "8h",
  }),
  user: pub(u),
});
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const password = z.string().min(8, "Use at least 8 characters");
const creds = z.object({ email: z.string().email().toLowerCase(), password });
const me = async (req: Parameters<typeof userId>[0]) => {
  const u = await prisma.user.findUnique({ where: { id: userId(req) } });
  if (!u) throw new HttpError(401, "Account no longer exists");
  return u as U;
};

/** Single-use token, stored hashed. Emails the link, or prints it when SMTP is not configured. */
async function sendLink(
  u: { id: string; email: string; name: string },
  kind: "verify" | "reset",
) {
  const token = crypto.randomBytes(32).toString("hex"),
    hours = kind === "verify" ? 24 : 1;
  const data =
    kind === "verify"
      ? {
          verifyTokenHash: hash(token),
          verifyExpires: new Date(Date.now() + hours * 3600_000),
        }
      : {
          resetTokenHash: hash(token),
          resetExpires: new Date(Date.now() + hours * 3600_000),
        };
  await prisma.user.update({ where: { id: u.id }, data });
  const link = `${config.appUrl}/${kind === "verify" ? "verify-email" : "reset-password"}?token=${token}`;
  const [subject, line] =
    kind === "verify"
      ? [
          "Verify your CloudTrace email",
          "Confirm your email address to activate your CloudTrace account:",
        ]
      : [
          "Reset your CloudTrace password",
          "Use this link to choose a new password:",
        ];
  return sendMail(
    u.email,
    subject,
    `Hi ${u.name},\n\n${line}\n${link}\n\nThis link expires in ${hours} ${hours === 1 ? "hour" : "hours"}. If you didn't request it, ignore this message.`,
  );
}

r.get("/config", (_req, res) =>
  res.json({
    google: config.googleClientId,
    emailDelivery: mailConfigured,
    ai: config.aiMode,
  }),
);

r.post("/register", mailLimiter, async (req, res) => {
  const b = creds.extend({ name: z.string().trim().min(2) }).parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: b.email } });
  if (existing?.emailVerified)
    throw new HttpError(409, "An account with this email already exists");
  const passwordHash = await bcrypt.hash(b.password, 12);
  let u;
  try {
    u = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: b.name, passwordHash },
        })
      : await prisma.user.create({
          data: { name: b.name, email: b.email, passwordHash },
        });
  } catch (e) {
    // Two simultaneous sign-ups for one address: the loser gets the same answer as a duplicate.
    if (isUniqueViolation(e))
      throw new HttpError(409, "An account with this email already exists");
    throw e;
  }
  if (config.devAutoVerify) {
    res
      .status(201)
      .json({
        ...issue(
          await prisma.user.update({
            where: { id: u.id },
            data: { emailVerified: true },
          }),
        ),
        verified: true,
      });
    return;
  }
  res
    .status(201)
    .json({
      verificationRequired: true,
      email: u.email,
      delivered: await sendLink(u, "verify"),
    });
});

r.post("/verify", async (req, res) => {
  const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
  const u = await prisma.user.findFirst({
    where: { verifyTokenHash: hash(token), verifyExpires: { gt: new Date() } },
  });
  if (!u)
    throw new HttpError(
      400,
      "This verification link is invalid or has expired. Request a new one from the sign-in page.",
    );
  res.json(
    issue(
      await prisma.user.update({
        where: { id: u.id },
        data: {
          emailVerified: true,
          verifyTokenHash: null,
          verifyExpires: null,
        },
      }),
    ),
  );
});
r.post("/resend", mailLimiter, async (req, res) => {
  const { email } = z
    .object({ email: z.string().email().toLowerCase() })
    .parse(req.body);
  const u = await prisma.user.findUnique({ where: { email } });
  res.json({
    ok: true,
    // Same shape for unknown and already-verified addresses: `delivered` falls back to whether mail is configured at all.
    delivered:
      u && !u.emailVerified ? await sendLink(u, "verify") : mailConfigured,
  });
});

r.post("/login", loginLimiter, async (req, res) => {
  const b = creds.parse(req.body);
  const u = await prisma.user.findUnique({ where: { email: b.email } });
  if (u && !u.passwordHash)
    throw new HttpError(
      401,
      'This account uses Google sign-in. Continue with Google, or use "Forgot password" to set a password.',
    );
  if (!(await bcrypt.compare(b.password, u?.passwordHash ?? DUMMY_HASH)) || !u)
    throw new HttpError(401, "Email or password is incorrect");
  if (!u.emailVerified)
    throw new HttpError(403, "Verify your email address before signing in.", [
      "EMAIL_NOT_VERIFIED",
    ]);
  res.json(issue(u));
});

r.post("/google", async (req, res) => {
  if (!config.googleClientId)
    throw new HttpError(503, "Google sign-in is not configured on this server");
  const { credential } = z
    .object({ credential: z.string().min(20) })
    .parse(req.body);
  let p;
  try {
    p = (
      await new OAuth2Client(config.googleClientId).verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      })
    ).getPayload();
  } catch {
    throw new HttpError(
      401,
      "Google sign-in could not be verified. Try again.",
    );
  }
  if (!p?.email || !p.email_verified)
    throw new HttpError(401, "Your Google email address is not verified");
  const email = p.email.toLowerCase(),
    byGoogle = await prisma.user.findUnique({ where: { googleId: p.sub } }),
    existing = byGoogle ?? (await prisma.user.findUnique({ where: { email } }));
  if (existing?.googleId && existing.googleId !== p.sub)
    throw new HttpError(
      409,
      "This email is already linked to a different Google account.",
    );
  res.json(
    issue(
      existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              googleId: p.sub,
              emailVerified: true,
              verifyTokenHash: null,
              verifyExpires: null,
              // A password set on a never-verified account was chosen by whoever pre-registered the address,
              // not necessarily its owner. Google proves ownership, so that password is discarded.
              ...(existing.emailVerified
                ? {}
                : { passwordHash: null, tokenVersion: { increment: 1 } }),
            },
          })
        : await prisma.user.create({
            data: {
              name: p.name ?? email.split("@")[0],
              email,
              googleId: p.sub,
              emailVerified: true,
            },
          }),
    ),
  );
});

r.post("/forgot", mailLimiter, async (req, res) => {
  const { email } = z
    .object({ email: z.string().email().toLowerCase() })
    .parse(req.body);
  const u = await prisma.user.findUnique({ where: { email } });
  res.json({
    ok: true,
    delivered: u ? await sendLink(u, "reset") : mailConfigured,
  });
});
r.post("/reset", async (req, res) => {
  const b = z.object({ token: z.string().min(10), password }).parse(req.body);
  const u = await prisma.user.findFirst({
    where: { resetTokenHash: hash(b.token), resetExpires: { gt: new Date() } },
  });
  if (!u)
    throw new HttpError(
      400,
      "This reset link is invalid or has expired. Request a new one.",
    );
  res.json(
    issue(
      await prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: await bcrypt.hash(b.password, 12),
          resetTokenHash: null,
          resetExpires: null,
          emailVerified: true,
          tokenVersion: { increment: 1 },
        },
      }),
    ),
  );
});

r.get("/me", requireAuth, async (req, res) =>
  res.json({ user: pub(await me(req)) }),
);
r.patch("/profile", requireAuth, async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(80) })
    .parse(req.body);
  res.json({
    user: pub(
      (await prisma.user.update({
        where: { id: userId(req) },
        data: { name },
      })) as U,
    ),
  });
});
r.post("/password", requireAuth, async (req, res) => {
  const b = z
    .object({ currentPassword: z.string().optional(), newPassword: password })
    .parse(req.body);
  const u = await me(req);
  if (
    u.passwordHash &&
    !(
      b.currentPassword &&
      (await bcrypt.compare(b.currentPassword, u.passwordHash))
    )
  )
    throw new HttpError(400, "Your current password is incorrect");
  res.json(
    issue(
      await prisma.user.update({
        where: { id: u.id },
        data: {
          passwordHash: await bcrypt.hash(b.newPassword, 12),
          tokenVersion: { increment: 1 },
        },
      }),
    ),
  );
});
r.post("/logout-all", requireAuth, async (req, res) =>
  res.json(
    issue(
      await prisma.user.update({
        where: { id: userId(req) },
        data: { tokenVersion: { increment: 1 } },
      }),
    ),
  ),
);
r.delete("/account", requireAuth, async (req, res) => {
  const b = z
    .object({ confirm: z.string(), password: z.string().optional() })
    .parse(req.body);
  const u = await me(req);
  if (b.confirm.toLowerCase() !== u.email)
    throw new HttpError(400, "Type your email address exactly to confirm");
  if (
    u.passwordHash &&
    !(b.password && (await bcrypt.compare(b.password, u.passwordHash)))
  )
    throw new HttpError(400, "Your password is incorrect");
  await prisma.user.delete({ where: { id: u.id } });
  res.status(204).end();
});
export default r;
