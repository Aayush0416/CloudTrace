import {
  useEffect,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export function usePersisted<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  }, [key, v]);
  return [v, setV] as const;
}

/** Resizable (drag, arrow keys, double-click to reset) and collapsible side panel. Width is remembered per panel. */
export function SidePanel({
  side,
  id,
  title,
  defaultWidth,
  min,
  max,
  collapsed,
  onToggle,
  children,
}: {
  side: "left" | "right";
  id: string;
  title: string;
  defaultWidth: number;
  min: number;
  max: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const [w, setW] = usePersisted(`ct_panel_${id}`, defaultWidth);
  const clamp = (x: number) => Math.min(max, Math.max(min, x)),
    sign = side === "left" ? 1 : -1;
  const drag = (e: PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX,
      w0 = w;
    const move = (ev: globalThis.PointerEvent) =>
      setW(clamp(w0 + (ev.clientX - x0) * sign));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setW((x) => clamp(x + (e.key === "ArrowRight" ? 16 : -16) * sign));
    }
  };
  const Collapse = side === "left" ? ChevronsLeft : ChevronsRight,
    Expand = side === "left" ? ChevronsRight : ChevronsLeft;
  const border = side === "left" ? "border-r" : "border-l";
  if (collapsed)
    return (
      <aside
        className={`flex w-10 shrink-0 flex-col items-center gap-3 ${border} border-line bg-panel py-2`}
      >
        <button
          aria-label={`Expand ${title}`}
          title={`Expand ${title}`}
          onClick={onToggle}
          className="rounded p-1.5 text-muted hover:bg-raised hover:text-fg"
        >
          <Expand size={16} />
        </button>
        <span className="text-xs text-muted [writing-mode:vertical-rl]">
          {title}
        </span>
      </aside>
    );
  return (
    <aside
      style={{ width: w }}
      className={`relative flex shrink-0 flex-col ${border} border-line bg-panel`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="font-semibold">{title}</span>
        <button
          aria-label={`Collapse ${title}`}
          title={`Collapse ${title}`}
          onClick={onToggle}
          className="rounded p-1 text-muted hover:bg-raised hover:text-fg"
        >
          <Collapse size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title}`}
        aria-valuenow={w}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        title="Drag to resize. Double-click to reset."
        onPointerDown={drag}
        onDoubleClick={() => setW(defaultWidth)}
        onKeyDown={key}
        className={`absolute inset-y-0 z-10 w-1.5 cursor-col-resize transition-colors hover:bg-accent/50 focus-visible:bg-accent/60 ${side === "left" ? "-right-[3px]" : "-left-[3px]"}`}
      />
    </aside>
  );
}
