import { useEffect, useState } from "react";
import { useInView } from "../ui/motion.ts";

const STEPS = [
  { name: "Tile", spec: "48 × 48, r 12" },
  { name: "Stem", spec: "7 × 25" },
  { name: "Bowl", spec: "r 9.5, counter 3.5" },
  { name: "Double rule", spec: "23 × 2.6, twice" },
];

const STEP_MS = 900;

/** Plays `count` steps once `active` turns true; `replay` starts over. Reduced motion jumps to the end. */
function useSequence(active: boolean, count: number) {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(count);
      return;
    }
    setStep(0);
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setStep(i + 1), 350 + i * STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [active, run, count]);
  return [step, () => setRun((r) => r + 1)] as const;
}

/** The mark drawn step by step on blueprint paper, with its construction lines and dimensions. */
export function Construction() {
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const [step, replay] = useSequence(seen, STEPS.length);
  const on = (n: number) => (step >= n ? " on" : "");

  return (
    <div className="construct" ref={ref} data-step={step}>
      <div className="construct-panel blueprint">
        <svg viewBox="-18 -17 86 82" role="img" aria-labelledby="construct-title">
          <title id="construct-title">The Pacioli mark: a P over a lime and coral double rule, on a lime tile</title>

          {/* Construction lines */}
          <g className={`c-lines${on(1)}`}>
            <line x1="-12" y1="24" x2="60" y2="24" />
            <line x1="24" y1="-12" x2="24" y2="60" />
            <circle cx="24" cy="24" r="1.4" />
          </g>

          {/* Tile */}
          <rect className={`c-tile${on(1)}`} width="48" height="48" rx="12" />
          <rect className={`c-tile-line${on(1)}`} width="48" height="48" rx="12" pathLength={1} />

          {/* Stem and bowl */}
          <rect className={`c-stem${on(2)}`} x="13" y="8" width="7" height="25" />
          <circle className={`c-circle${on(3)}`} cx="25.5" cy="17.5" r="9.5" pathLength={1} />
          <path
            className={`c-bowl${on(3)}`}
            fillRule="evenodd"
            d="M19.6 8h5.9a9.5 9.5 0 0 1 0 19H19.6zm0.4 6v7h5a3.5 3.5 0 0 0 0-7z"
          />

          {/* Double rule */}
          <rect className={`c-rule upper${on(4)}`} x="13" y="36" width="23" height="2.6" rx="1.3" />
          <rect className={`c-rule lower${on(4)}`} x="13" y="40.6" width="23" height="2.6" rx="1.3" />

          {/* Dimensions */}
          <g className={`c-dim${on(1)}`}>
            <path d="M0 -8H48M0 -10.5V-5.5M48 -10.5V-5.5" />
            <text x="24" y="-10.5">48</text>
          </g>
          <g className={`c-dim${on(2)}`}>
            <path d="M-7 8V33M-9.5 8H-4.5M-9.5 33H-4.5" />
            <text x="-10" y="21.5" transform="rotate(-90 -10 21.5)">25</text>
          </g>
          <g className={`c-dim${on(3)}`}>
            <path d="M25.5 17.5L32.2 10.8L40 3H58" />
            <circle cx="25.5" cy="17.5" r="0.9" />
            <text x="58" y="1.2" className="end">r 9.5</text>
          </g>
          <g className={`c-dim${on(4)}`}>
            <path d="M13 54H36M13 51.5V56.5M36 51.5V56.5" />
            <text x="24.5" y="61.5">23</text>
            <path d="M51 36H55M51 43.2H55M53 36V43.2" />
            <text x="57" y="41" className="start">7.2</text>
          </g>
        </svg>
        <button className="lime construct-replay" onClick={replay} disabled={step > 0 && step < STEPS.length}>
          Replay
        </button>
      </div>

      <ol className="construct-steps" aria-label="How the mark is built">
        {STEPS.map((s, i) => (
          <li key={s.name} className={step >= i + 1 ? "on" : undefined}>
            <b>{String(i + 1).padStart(2, "0")}</b>
            <span>
              <strong>{s.name}</strong>
              <small>{s.spec}</small>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
