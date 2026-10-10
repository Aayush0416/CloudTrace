import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { api, TOKEN_KEY, UNAUTHORIZED_EVENT } from "./api";
import type { User } from "./types";

interface Auth {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(
    name: string,
    email: string,
    password: string,
  ): Promise<{ email: string; delivered: boolean; auto?: boolean }>;
  updateUser(u: User): void;
  google(credential: string): Promise<void>;
  loginWithToken(d: { token: string; user: User }): void;
  logout(): void;
}
const Ctx = createContext<Auth>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));
  // The API client reports a rejected token with an event; sign out in memory and let the route guard decide where to go.
  useEffect(() => {
    const h = () => {
      setUser(null);
      qc.clear();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, h);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, h);
  }, [qc]);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let cancelled = false;
    // A network blip or a 5xx must not sign the user out: retry, and only drop the token if the server rejects it.
    (async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const r = await api.get("/auth/me");
          if (!cancelled) setUser(r.data.user);
          break;
        } catch (e) {
          const status = axios.isAxiosError(e) ? e.response?.status : undefined;
          if (status === 401 || status === 403 || status === 404) {
            localStorage.removeItem(TOKEN_KEY);
            break;
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const finish = (d: { token: string; user: User }) => {
    localStorage.setItem(TOKEN_KEY, d.token);
    setUser(d.user);
  };
  const value: Auth = {
    user,
    loading,
    login: async (email, password) =>
      finish((await api.post("/auth/login", { email, password })).data),
    register: async (name, email, password) => {
      const d = (await api.post("/auth/register", { name, email, password }))
        .data;
      if (d.token) {
        finish(d);
        return { email, delivered: true, auto: true };
      }
      return d;
    },
    updateUser: setUser,
    google: async (credential) =>
      finish((await api.post("/auth/google", { credential })).data),
    loginWithToken: finish,
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("ct_project");
      qc.clear();
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
