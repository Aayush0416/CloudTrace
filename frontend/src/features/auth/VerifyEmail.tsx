import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, errorInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Loading } from "../../components/ui";

export default function VerifyEmail() {
  const token = useSearchParams()[0].get("token"),
    { loginWithToken } = useAuth(),
    nav = useNavigate();
  const [error, setError] = useState(
      token ? "" : "This verification link is missing its token.",
    ),
    once = useRef(false);
  useEffect(() => {
    if (!token || once.current) return;
    once.current = true; // the token is single-use; avoid the StrictMode double call
    api
      .post("/auth/verify", { token })
      .then((r) => {
        loginWithToken(r.data);
        nav("/projects", { replace: true });
      })
      .catch((e) => setError(errorInfo(e).message));
  }, [token]);
  return (
    <div className="flex h-full items-center justify-center p-4">
      {error ? (
        <div className="max-w-sm space-y-3 rounded border border-line bg-panel p-5">
          <h1 className="text-base font-semibold">
            Couldn't verify your email
          </h1>
          <p role="alert" className="text-crit">
            {error}
          </p>
          <Link className="text-accent hover:underline" to="/login">
            Back to sign in
          </Link>
        </div>
      ) : (
        <Loading label="Verifying your email" />
      )}
    </div>
  );
}
