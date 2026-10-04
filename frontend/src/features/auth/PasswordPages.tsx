import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Waypoints } from "lucide-react";
import { api, errorInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Field, inputCls } from "../../components/ui";

const Shell = ({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) => (
  <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-navy-800),var(--color-bg)_60%)] p-4">
    <div className="w-full max-w-sm">
      <Link
        to="/"
        className="mb-6 flex items-center gap-2 text-lg font-semibold"
      >
        <Waypoints className="text-accent" />
        CloudTrace
      </Link>
      <div className="space-y-4 rounded-md border border-line bg-panel p-6">
        <div>
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="mt-1 text-muted">{sub}</p>
        </div>
        {children}
      </div>
    </div>
  </div>
);

export function ForgotPassword() {
  const [email, setEmail] = useState(""),
    [state, setState] = useState<"idle" | "busy" | "done">("idle"),
    [error, setError] = useState(""),
    [delivered, setDelivered] = useState(true);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const r = await api.post("/auth/forgot", { email });
      setDelivered(r.data.delivered);
      setState("done");
    } catch (x) {
      setError(errorInfo(x).message);
      setState("idle");
    }
  };
  return (
    <Shell
      title="Reset your password"
      sub="Enter your account email and we'll send a reset link."
    >
      {state === "done" ? (
        <>
          <p className="text-muted">
            If an account exists for <span className="text-fg">{email}</span>, a
            reset link is on its way. It expires in 1 hour.
          </p>
          {!delivered && (
            <p className="rounded border border-med/40 bg-med/10 px-3 py-2 text-med">
              This server isn't set up to send email. When running locally, copy
              the link from the backend console.
            </p>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="text-crit">
              {error}
            </div>
          )}
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button
            variant="primary"
            type="submit"
            busy={state === "busy"}
            className="w-full"
          >
            Send reset link
          </Button>
        </form>
      )}
      <Link to="/login" className="block text-accent hover:underline">
        Back to sign in
      </Link>
    </Shell>
  );
}

export function ResetPassword() {
  const token = useSearchParams()[0].get("token"),
    { loginWithToken } = useAuth(),
    nav = useNavigate();
  const [pw, setPw] = useState(""),
    [error, setError] = useState(
      token ? "" : "This reset link is missing its token.",
    ),
    [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters");
    setBusy(true);
    setError("");
    try {
      const r = await api.post("/auth/reset", { token, password: pw });
      loginWithToken(r.data);
      nav("/home", { replace: true });
    } catch (x) {
      setError(errorInfo(x).message);
      setBusy(false);
    }
  };
  return (
    <Shell
      title="Choose a new password"
      sub="You'll be signed in after saving. Other sessions are signed out."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div role="alert" className="text-crit">
            {error}
          </div>
        )}
        <Field label="New password">
          <input
            className={inputCls}
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </Field>
        <Button
          variant="primary"
          type="submit"
          busy={busy}
          disabled={!token}
          className="w-full"
        >
          Save password
        </Button>
      </form>
      <Link to="/forgot-password" className="block text-accent hover:underline">
        Request a new link
      </Link>
    </Shell>
  );
}
