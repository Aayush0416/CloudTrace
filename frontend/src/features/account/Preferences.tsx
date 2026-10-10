import { Monitor, Moon, Sun } from "lucide-react";
import { Button, Card } from "../../components/ui";
import { usePrefs, type Prefs, type ThemeChoice } from "../../lib/prefs";

/** Radio-style segmented control, keyboard and screen-reader friendly. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded border border-line bg-bg p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-9 rounded px-3 text-sm sm:h-8 ${value === o.value ? "bg-brand text-on-brand" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Row = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
    <div className="min-w-0">
      <div className="font-medium text-heading">{title}</div>
      <div className="text-muted">{hint}</div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

/** Swatches use fixed colours so each option previews the theme it selects, whichever theme is active now. */
const THEMES: {
  value: ThemeChoice;
  label: string;
  icon: typeof Sun;
  bg: string;
  panel: string;
  accent: string;
  text: string;
}[] = [
  { value: "dark", label: "Dark", icon: Moon, bg: "#000000", panel: "#14213d", accent: "#fca311", text: "#e5e5e5" },
  { value: "light", label: "Light", icon: Sun, bg: "#F8F4EC", panel: "#14213D", accent: "#FCA311", text: "#14213D" },
  { value: "system", label: "Match my device", icon: Monitor, bg: "linear-gradient(90deg,#000 50%,#F8F4EC 50%)", panel: "#14213D", accent: "#FCA311", text: "#888" },
];

export default function Preferences() {
  const { prefs, set, reset } = usePrefs();
  return (
    <Card
      title="Preferences"
      actions={
        <Button variant="ghost" onClick={reset}>
          Restore defaults
        </Button>
      }
    >
      <div className="p-4">
        <div className="pb-5">
          <div className="font-medium text-heading">Theme</div>
          <div className="mb-3 text-muted">
            Choose how CloudTrace looks. Your choice is saved on this device.
          </div>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid gap-3 sm:grid-cols-3"
          >
            {THEMES.map((t) => {
              const on = prefs.theme === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("theme", t.value)}
                  className={`rounded-md border p-2 text-left transition-colors ${on ? "border-accent ring-1 ring-accent" : "border-line hover:border-navy-700"}`}
                >
                  <div
                    className="relative h-16 overflow-hidden rounded border border-black/10"
                    style={{ background: t.bg }}
                    aria-hidden
                  >
                    <div
                      className="absolute left-2 top-2 h-2 w-10 rounded"
                      style={{ background: t.accent }}
                    />
                    <div
                      className="absolute bottom-2 left-2 right-2 h-5 rounded"
                      style={{ background: t.panel }}
                    />
                    <div
                      className="absolute right-2 top-2 h-2 w-4 rounded"
                      style={{ background: t.text, opacity: 0.6 }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-medium">
                    <t.icon size={14} />
                    {t.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Row
          title="Table density"
          hint="Compact fits more rows on screen in tables."
        >
          <Segmented<Prefs["density"]>
            label="Table density"
            value={prefs.density}
            onChange={(v) => set("density", v)}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
          />
        </Row>
        <Row
          title="Reduce motion"
          hint="Stops the animated graph line and the 3D scene movement."
        >
          <Segmented<"on" | "off">
            label="Reduce motion"
            value={prefs.reduceMotion ? "on" : "off"}
            onChange={(v) => set("reduceMotion", v === "on")}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
          />
        </Row>
        <Row
          title="Attack graph direction"
          hint="How the graph is drawn when you open it. You can still switch on the graph itself."
        >
          <Segmented<Prefs["graphDir"]>
            label="Attack graph direction"
            value={prefs.graphDir}
            onChange={(v) => {
              set("graphDir", v);
              // the graph remembers the last direction used; a new default should apply the next time it opens
              localStorage.removeItem("ct_graph_dir");
            }}
            options={[
              { value: "LR", label: "Horizontal" },
              { value: "TB", label: "Vertical" },
            ]}
          />
        </Row>
        <Row
          title="Open after sign-in"
          hint="The page you land on when you sign in or open CloudTrace."
        >
          <Segmented<Prefs["startPage"]>
            label="Page after sign-in"
            value={prefs.startPage}
            onChange={(v) => set("startPage", v)}
            options={[
              { value: "home", label: "Home" },
              { value: "projects", label: "Projects" },
            ]}
          />
        </Row>
      </div>
    </Card>
  );
}
