import axios from "axios";
export const TOKEN_KEY = "ct_token";
export const api = axios.create({ baseURL: "/api" });
api.interceptors.request.use((c) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
api.interceptors.response.use(
  (r) => r,
  (e) => {
    const url = String(e.config?.url ?? "");
    if (
      e.response?.status === 401 &&
      !url.startsWith("/auth/login") &&
      !url.startsWith("/auth/register")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      if (!location.pathname.startsWith("/login")) location.assign("/login");
    }
    return Promise.reject(e);
  },
);
export function errorInfo(e: unknown): { message: string; details: string[] } {
  if (axios.isAxiosError(e)) {
    if (!e.response)
      return {
        message:
          "Cannot reach the CloudTrace API. Check that the backend is running on port 4000.",
        details: [],
      };
    const d = e.response.data;
    return {
      message: d?.error ?? "Request failed",
      details: Array.isArray(d?.details)
        ? d.details.map((x: unknown) =>
            typeof x === "string" ? x : JSON.stringify(x),
          )
        : [],
    };
  }
  return { message: "Unexpected error", details: [] };
}
