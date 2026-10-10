import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useStartPath } from "../../lib/prefs";
import ThemeToggle from "../../components/ThemeToggle";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MailCheck, MailX, Waypoints } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { api, errorInfo } from "../../lib/api";
import { useAuthConfig } from "../../lib/queries";
import { Button, Field, inputCls } from "../../components/ui";
import GoogleButton from "./GoogleButton";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});
type Form = z.infer<typeof schema>;
interface Pending {
  email: string;
  delivered: boolean;
}

function CheckInbox({ p, onBack }: { p: Pending; onBack: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
      "idle",
    ),
    [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const resend = async () => {
    setState("sending");
    try {
      await api.post("/auth/resend", { email: p.email });
      setState("sent");
      setWait(30);
    } catch {
      setState("error");
    }
  };
  const Icon = p.delivered ? MailCheck : MailX;
  return (
    <div className="space-y-4 rounded-xl border border-line bg-panel p-6 shadow-[var(--card-shadow)] sm:p-7">
      <Icon className={p.delivered ? "text-accent" : "text-med"} size={22} />
      <h1 className="text-base font-semibold">
        {p.delivered ? "Check your email" : "We couldn't send the email"}
      </h1>
      {p.delivered ? (
        <p className="text-muted">
          We sent a verification link to{" "}
          <span className="text-fg">{p.email}</span>. Open it to activate your
          account. The link expires in 24 hours.
        </p>
      ) : (
        <p className="text-muted">
          Your account for <span className="text-fg">{p.email}</span> was
          created, but the verification email could not be sent right now. Use
          Resend below to try again in a moment.
        </p>
      )}
      {state === "sent" && (
        <p className="text-ok">
          If this account still needs verification, a new link is on its way.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-crit">
          Couldn't resend the email. Try again in a moment.
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={resend} busy={state === "sending"} disabled={wait > 0}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend email"}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </div>
  );
}

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register: signUp, google } = useAuth(),
    cfg = useAuthConfig(),
    nav = useNavigate(),
    start = useStartPath();
  const [error, setError] = useState(""),
    [pending, setPending] = useState<Pending | null>(null),
    reg = mode === "register";
  const {
    register,
    handleSubmit,
    getValues,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });
  if (user) return <Navigate to={start} replace />;
  const submit = async (f: Form) => {
    if (reg && (f.name?.trim().length ?? 0) < 2)
      return setFieldError("name", { message: "Enter your name" });
    setError("");
    try {
      if (reg) {
        const r = await signUp(f.name!.trim(), f.email, f.password);
        if (!r.auto) setPending({ email: r.email, delivered: r.delivered });
      } else {
        await login(f.email, f.password);
        nav(start);
      }
    } catch (e) {
      const i = errorInfo(e);
      if (i.details.includes("EMAIL_NOT_VERIFIED"))
        setPending({ email: getValues("email"), delivered: true });
      else setError(i.message);
    }
  };
  const onGoogle = async (c: string) => {
    setError("");
    try {
      await google(c);
      nav(start);
    } catch (e) {
      setError(errorInfo(e).message);
    }
  };
  return (
    <div className="relative flex min-h-full items-center justify-center display bg-bg p-4">
      <ThemeToggle className="absolute right-3 top-3" />
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-6 flex items-center gap-2 text-lg font-semibold"
        >
          <Waypoints className="text-accent" />
          CloudTrace
        </Link>
        {pending ? (
          <CheckInbox
            p={pending}
            onBack={() => {
              setPending(null);
              nav("/login");
            }}
          />
        ) : (
          <>
            <form
              onSubmit={handleSubmit(submit)}
              noValidate
              className="space-y-4 rounded-md border border-line bg-panel p-6"
            >
              <div>
                <h1 className="text-[24px] leading-tight">
                  {reg ? "Create your account" : "Sign in"}
                </h1>
                <p className="mt-1 text-muted">
                  Find the paths an attacker could take through your cloud
                  environment.
                </p>
              </div>
              {error && (
                <div
                  role="alert"
                  className="rounded border border-crit/40 bg-crit/10 px-3 py-2 text-crit"
                >
                  {error}
                </div>
              )}
              {reg && (
                <Field label="Name" error={errors.name?.message}>
                  <input
                    className={inputCls}
                    autoComplete="name"
                    {...register("name")}
                  />
                </Field>
              )}
              <Field label="Email" error={errors.email?.message}>
                <input
                  className={inputCls}
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
              </Field>
              <Field label="Password" error={errors.password?.message}>
                <input
                  className={inputCls}
                  type="password"
                  autoComplete={reg ? "new-password" : "current-password"}
                  {...register("password")}
                />
              </Field>
              {!reg && (
                <div className="-mt-2 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-accent hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
              <Button
                variant="primary"
                type="submit"
                busy={isSubmitting}
                className="w-full"
              >
                {reg ? "Create account" : "Sign in"}
              </Button>
              {reg && (
                <p className="text-xs text-muted">
                  We'll email a link to confirm this address before you can sign
                  in.
                </p>
              )}
              {cfg.data?.google && (
                <>
                  <div className="flex items-center gap-3 text-muted">
                    <span className="h-px flex-1 bg-line" />
                    or
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <GoogleButton
                  clientId={cfg.data.google}
                  onCredential={onGoogle}
                />
                </>
              )}
            </form>
            <p className="mt-4 text-center text-muted">
              {reg ? "Already have an account?" : "New to CloudTrace?"}{" "}
              <Link
                className="text-accent hover:underline"
                to={reg ? "/login" : "/register"}
              >
                {reg ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
