import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useInView } from "../ui/motion.ts";

/** Below this container width, diagrams switch to their narrow layout. */
const COMPACT_BELOW = 600;

/** Monospace advance in em: JetBrains Mono is 0.6em per glyph, so label widths are predictable. */
export const MONO_ADVANCE = 0.6;

export const textWidth = (text: string, size: number) =>
  text.length * size * MONO_ADVANCE;

export const delay = (seconds: number) =>
  ({ "--d": `${seconds}s` }) as CSSProperties;

export function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export interface DiagramState {
  ref: RefObject<HTMLElement | null>;
  /** Scrolled into view: animations may start. */
  on: boolean;
  /** Narrow container: use the stacked layout. */
  compact: boolean;
  reduced: boolean;
  /** Bumped by replay; use as a React key to restart CSS animations. */
  run: number;
  replay: () => void;
}

export function useDiagram(threshold = 0.3): DiagramState {
  const [ref, on] = useInView<HTMLElement>(threshold);
  const width = useWidth(ref);
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  return {
    ref,
    on,
    compact: width > 0 && width < COMPACT_BELOW,
    reduced,
    run,
    replay: () => setRun((n) => n + 1),
  };
}

/** A technical drawing on a card: label, title, actions, the drawing, a caption. */
export function Figure({
  dg,
  label,
  title,
  actions,
  caption,
  children,
}: {
  dg: DiagramState;
  label: string;
  title: ReactNode;
  actions?: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
}) {
  // The reveal lives on a wrapper: React owns the figure's className and
  // would wipe the "in" class useReveal adds whenever `on` or `compact` flips.
  return (
    <div data-reveal="scale">
      <figure
        ref={dg.ref as RefObject<HTMLElement>}
        className={cx("dg", dg.on && "on", dg.compact && "compact")}
      >
        <header className="dg-head">
          <span className="dg-label">{label}</span>
          <h3>{title}</h3>
          {actions && <div className="dg-actions">{actions}</div>}
        </header>
        {children}
        {caption && <figcaption>{caption}</figcaption>}
      </figure>
    </div>
  );
}

export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ghost dg-btn" onClick={onClick}>
      <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
        <path
          d="M3 8a5 5 0 1 0 1.6-3.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M2.5 2.2v3.4h3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
      Replay
    </button>
  );
}

/** Arrowhead pointing from (fromX, fromY) towards (x, y). */
export function arrowHead(
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  size = 8,
) {
  const angle = Math.atan2(y - fromY, x - fromX);
  const spread = 0.45;
  const ax = x - size * Math.cos(angle - spread);
  const ay = y - size * Math.sin(angle - spread);
  const bx = x - size * Math.cos(angle + spread);
  const by = y - size * Math.sin(angle + spread);
  return `${x},${y} ${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
}

/**
 * Moves its children along an SVG path once, driven by requestAnimationFrame
 * so it restarts reliably whenever `runKey` changes. With reduced motion it
 * simply sits at the end of the path.
 */
export function Traveler({
  d,
  runKey,
  duration = 900,
  wait = 0,
  reduced,
  children,
}: {
  d: string;
  runKey: string | number;
  duration?: number;
  wait?: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const path = pathRef.current;
    const group = groupRef.current;
    if (!path || !group) return;
    const length = path.getTotalLength();
    const place = (t: number) => {
      const p = path.getPointAtLength(length * t);
      group.setAttribute(
        "transform",
        `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`,
      );
      group.style.opacity = t <= 0 || t >= 1 ? "0" : "1";
    };
    if (reduced) {
      place(1);
      return;
    }
    let frame = 0;
    const start = performance.now() + wait;
    place(0);
    const tick = (now: number) => {
      const raw = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;
      place(raw >= 1 ? 1 : Math.max(eased, 0.0001));
      if (raw < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [d, runKey, duration, wait, reduced]);
  return (
    <>
      <path ref={pathRef} d={d} fill="none" stroke="none" />
      <g ref={groupRef} style={{ opacity: 0 }} aria-hidden="true">
        {children}
      </g>
    </>
  );
}

/** Animates a number towards `value`, for live ledger figures. */
export function useTween(value: number, reduced: boolean, duration = 600) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = origin + (value - origin) * (1 - (1 - t) ** 3);
      from.current = next;
      setShown(t >= 1 ? value : next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, duration]);
  return Math.round(shown);
}

/** Accessible tab strip with arrow-key navigation. */
export function Tabs<K extends string>({
  label,
  items,
  value,
  onChange,
  idPrefix,
}: {
  label: string;
  items: ReadonlyArray<readonly [K, string]>;
  value: K;
  onChange: (key: K) => void;
  idPrefix: string;
}) {
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex(([key]) => key === value);
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = items[(index + step + items.length) % items.length][0];
    onChange(next);
    document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  };
  return (
    <div
      className="dg-tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
    >
      {items.map(([key, text]) => (
        <button
          key={key}
          id={`${idPrefix}-tab-${key}`}
          type="button"
          role="tab"
          aria-selected={key === value}
          aria-controls={`${idPrefix}-panel`}
          tabIndex={key === value ? 0 : -1}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
