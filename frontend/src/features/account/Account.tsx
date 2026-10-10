import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { api, errorInfo } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import Preferences from "./Preferences";
import {
  Button,
  Card,
  Field,
  inputCls,
  Modal,
  PageHeader,
} from "../../components/ui";

const Msg = ({ ok, text }: { ok?: boolean; text: string }) =>
  text ? (
    <p role={ok ? "status" : "alert"} className={ok ? "text-ok" : "text-crit"}>
      {text}
    </p>
  ) : null;
const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Card title={title}>
    <div className="space-y-4 p-4">{children}</div>
  </Card>
);

export default function Account() {
  const { user, updateUser, loginWithToken, logout } = useAuth(),
    nav = useNavigate();
  const [name, setName] = useState(user?.name ?? ""),
    [nameMsg, setNameMsg] = useState({ ok: false, text: "" }),
    [busy, setBusy] = useState("");
  const [cur, setCur] = useState(""),
    [next, setNext] = useState(""),
    [pwMsg, setPwMsg] = useState({ ok: false, text: "" });
  const [sessMsg, setSessMsg] = useState(""),
    [del, setDel] = useState(false),
    [confirm, setConfirm] = useState(""),
    [delPw, setDelPw] = useState(""),
    [delErr, setDelErr] = useState("");
  if (!user) return null;
  const run = async (key: string, f: () => Promise<void>) => {
    setBusy(key);
    try {
      await f();
    } finally {
      setBusy("");
    }
  };
  const saveName = () =>
    run("name", async () => {
      try {
        const r = await api.patch("/auth/profile", { name });
        updateUser({ ...user, ...r.data.user });
        setNameMsg({ ok: true, text: "Name updated." });
      } catch (e) {
        setNameMsg({ ok: false, text: errorInfo(e).message });
      }
    });
  const savePw = () =>
    run("pw", async () => {
      if (next.length < 8)
        return setPwMsg({ ok: false, text: "Use at least 8 characters" });
      try {
        const r = await api.post("/auth/password", {
          currentPassword: cur || undefined,
          newPassword: next,
        });
        loginWithToken(r.data);
        setCur("");
        setNext("");
        setPwMsg({
          ok: true,
          text: "Password saved. Other sessions were signed out.",
        });
      } catch (e) {
        setPwMsg({ ok: false, text: errorInfo(e).message });
      }
    });
  const signOutOthers = () =>
    run("sess", async () => {
      try {
        const r = await api.post("/auth/logout-all");
        loginWithToken(r.data);
        setSessMsg("All other sessions were signed out.");
      } catch (e) {
        setSessMsg(errorInfo(e).message);
      }
    });
  const remove = () =>
    run("del", async () => {
      try {
        await api.delete("/auth/account", {
          data: { confirm, password: delPw || undefined },
        });
        logout();
        nav("/");
      } catch (e) {
        setDelErr(errorInfo(e).message);
      }
    });
  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Account settings"
        sub="Appearance and preferences, your profile, sign-in methods and sessions."
      />
      <div className="space-y-5">
        <Preferences />
        <Section title="Profile">
          <Field label="Name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <div>
            <div className="mb-1 text-muted">Email</div>
            <div className="flex items-center gap-2">
              {user.email}
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 text-ok">
                  <BadgeCheck size={14} />
                  Verified
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 text-muted">Sign-in methods</div>
            <div>
              {[
                user.hasPassword && "Email and password",
                user.googleLinked && "Google",
              ]
                .filter(Boolean)
                .join(" · ") || "None"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={saveName}
              busy={busy === "name"}
              disabled={name.trim().length < 2 || name === user.name}
            >
              Save changes
            </Button>
            <Msg ok={nameMsg.ok} text={nameMsg.text} />
          </div>
        </Section>
        <Section
          title={user.hasPassword ? "Change password" : "Set a password"}
        >
          {!user.hasPassword && (
            <p className="text-muted">
              You sign in with Google. Set a password to also sign in with your
              email.
            </p>
          )}
          {user.hasPassword && (
            <Field label="Current password">
              <input
                className={inputCls}
                type="password"
                autoComplete="current-password"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
              />
            </Field>
          )}
          <Field label="New password">
            <input
              className={inputCls}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={savePw}
              busy={busy === "pw"}
              disabled={!next}
            >
              Save password
            </Button>
            <Msg ok={pwMsg.ok} text={pwMsg.text} />
          </div>
        </Section>
        <Section title="Sessions">
          <p className="text-muted">
            Sign out every other browser and device that is signed in to this
            account.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={signOutOthers} busy={busy === "sess"}>
              Sign out other sessions
            </Button>
            <Msg ok text={sessMsg} />
          </div>
        </Section>
        <Card className="border-crit/40">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <h2 className="font-semibold text-crit">Delete account</h2>
              <p className="mt-1 text-muted">
                Permanently deletes your account, projects and scans.
              </p>
            </div>
            <Button variant="danger" onClick={() => setDel(true)}>
              Delete account
            </Button>
          </div>
        </Card>
      </div>
      {del && (
        <Modal title="Delete account" onClose={() => setDel(false)}>
          <div className="space-y-4">
            <p>
              This can't be undone. Type{" "}
              <span className="font-medium">{user.email}</span> to confirm.
            </p>
            <input
              className={inputCls}
              aria-label="Confirm email"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {user.hasPassword && (
              <Field label="Password">
                <input
                  className={inputCls}
                  type="password"
                  value={delPw}
                  onChange={(e) => setDelPw(e.target.value)}
                />
              </Field>
            )}
            <Msg text={delErr} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDel(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={remove}
                busy={busy === "del"}
                disabled={confirm.toLowerCase() !== user.email}
              >
                Delete my account
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
