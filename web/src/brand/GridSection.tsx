import { useState, type PointerEvent } from "react";
import { SectionHead, delay } from "./Head.tsx";

const MINOR = 24;

const RULES = [
  { value: "24", unit: "px", name: "Minor grid", text: "Every gap, padding and icon size is a multiple of 24 (or its half, 12)." },
  { value: "120", unit: "px", name: "Major grid", text: "Five minor cells. Heavier lines, used to place big blocks and illustrations." },
  { value: "|←→|", unit: "", name: "Dimension lines", text: "Thin cobalt lines with end ticks and a mono label. They measure, never decorate." },
  { value: "⊕", unit: "", name: "Center marks", text: "A crosshair at the center of round things: coins, seals, the bowl of the P." },
];

/** A patch of drafting paper. Move the pointer to snap a point to the 24 px grid. */
function Specimen() {
  const [grid, setGrid] = useState(true);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const snap = (v: number) => Math.round(v / MINOR) * MINOR;
    setPoint({ x: snap(e.clientX - box.left), y: snap(e.clientY - box.top) });
  };
  return (
    <figure className="specimen-wrap" data-reveal="up">
      <div
        className={grid ? "specimen" : "specimen grid-off"}
        onPointerMove={track}
        onPointerLeave={() => setPoint(null)}
        aria-hidden="true"
      >
        <div className="sp-dim h" style={{ left: 120, top: 92, width: 120 }}>
          <span>120</span>
        </div>
        <div className="sp-major" style={{ left: 120, top: 120 }} />
        <div className="sp-dim h small" style={{ left: 24, top: 188, width: 24 }}>
          <span>24</span>
        </div>
        <div className="sp-minor" style={{ left: 24, top: 216 }} />
        <div className="sp-card" style={{ left: 312, top: 48, width: 192, height: 168 }}>
          <i className="sp-center" />
          <span>192 × 168</span>
        </div>
        <div className="sp-ledger" style={{ left: 576, top: 48 }}>
          <span>Held</span>
          <b>100.00</b>
          <span>Charged</span>
          <b>−42.50</b>
          <span>Returned</span>
          <b>57.50</b>
        </div>
        {point && (
          <>
            <i className="sp-cross" style={{ left: point.x, top: point.y }} />
            <span className="sp-readout" style={{ left: point.x, top: point.y }}>
              {point.x}, {point.y}
            </span>
          </>
        )}
      </div>
      <figcaption>
        <span>Move across the sheet: the point snaps to the 24 px grid.</span>
        <button className="ghost small" aria-pressed={grid} onClick={() => setGrid(!grid)}>
          {grid ? "Hide grid" : "Show grid"}
        </button>
      </figcaption>
    </figure>
  );
}

export function GridSection() {
  return (
    <section className="section" id="grid">
      <div className="wrap">
        <SectionHead n="04" label="Grid" title={<>Drawn on <em className="serif">graph paper.</em></>}>
          Every page sits on the same sheet: a 24 px minor grid under a 120 px major grid. Things snap
          to it, and the drawing marks that come with it are part of the brand.
        </SectionHead>

        <dl className="grid-rules">
          {RULES.map((r, i) => (
            <div key={r.name} className="card" data-reveal="up" style={delay(i)}>
              <dt>
                <span className="grid-value">
                  {r.value}
                  {r.unit && <small>{r.unit}</small>}
                </span>
                <b>{r.name}</b>
              </dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>

        <Specimen />
      </div>
    </section>
  );
}
