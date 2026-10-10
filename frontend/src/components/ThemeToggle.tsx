import { Moon, Sun } from "lucide-react";
import { usePrefs } from "../lib/prefs";

/** One-tap switch between the dark and light themes. The full choice (including "match my device") is in Account settings. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, set } = usePrefs();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => set("theme", next)}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg sm:h-8 sm:w-8 ${className}`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
