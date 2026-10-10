import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "dark" | "light" | "system";
export interface Prefs {
  theme: ThemeChoice;
  /** Table and list spacing. */
  density: "comfortable" | "compact";
  /** Turns off animated graph lines, transitions and the 3D scene motion. */
  reduceMotion: boolean;
  /** Direction the attack graph is drawn in when it first opens. */
  graphDir: "LR" | "TB";
  /** Where to land after signing in. */
  startPage: "home" | "projects";
}
export const DEFAULT_PREFS: Prefs = {
  theme: "dark",
  density: "comfortable",
  reduceMotion: false,
  graphDir: "LR",
  startPage: "home",
};
const KEY = "ct_prefs";

function load(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}
const systemLight = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-color-scheme: light)").matches;

interface Ctx {
  prefs: Prefs;
  /** "dark" or "light": what is actually shown (resolves "system"). */
  theme: "dark" | "light";
  /** True when the user asked for reduced motion here or in the operating system. */
  reducedMotion: boolean;
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  reset: () => void;
}
const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [sysLight, setSysLight] = useState(systemLight);
  const [sysReduce, setSysReduce] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const a = matchMedia("(prefers-color-scheme: light)"),
      b = matchMedia("(prefers-reduced-motion: reduce)");
    const ha = () => setSysLight(a.matches),
      hb = () => setSysReduce(b.matches);
    a.addEventListener("change", ha);
    b.addEventListener("change", hb);
    return () => {
      a.removeEventListener("change", ha);
      b.removeEventListener("change", hb);
    };
  }, []);
  const theme: "dark" | "light" =
    prefs.theme === "system" ? (sysLight ? "light" : "dark") : prefs.theme;
  const reducedMotion = prefs.reduceMotion || sysReduce;

  // Layout effect: the CSS variables must be updated before child effects (the 3D scene) read them.
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.dataset.density = prefs.density;
    if (reducedMotion) el.dataset.motion = "reduce";
    else delete el.dataset.motion;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#14213D" : "#000000");
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [theme, prefs, reducedMotion]);

  const set = useCallback<Ctx["set"]>(
    (k, v) => setPrefs((p) => ({ ...p, [k]: v })),
    [],
  );
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);
  const value = useMemo(
    () => ({ prefs, theme, reducedMotion, set, reset }),
    [prefs, theme, reducedMotion, set, reset],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}

/** True below the lg breakpoint (1024px): the layout switches to the phone and tablet arrangement. */
export function useIsMobile() {
  const q = "(max-width: 1023px)";
  const [m, setM] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia(q).matches,
  );
  useEffect(() => {
    const mq = matchMedia(q),
      h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

/** Route a signed-in user lands on: Home, or Projects if chosen in account settings. */
export function useStartPath() {
  return usePrefs().prefs.startPage === "projects" ? "/projects" : "/home";
}
