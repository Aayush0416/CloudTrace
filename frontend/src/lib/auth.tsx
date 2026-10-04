import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, TOKEN_KEY } from "./api";
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
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
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
