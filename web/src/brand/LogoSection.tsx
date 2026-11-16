import type { ReactNode } from "react";
import { Mark } from "../ui/Shell.tsx";
import { SectionHead, Verdict, delay, type VerdictKind } from "./Head.tsx";

type MarkColors = { tile?: string; ink?: string; rule?: string };

/** Mark plus wordmark. `stack` puts the word under the mark. */
function Lockup({ colors, stack = false, word = true }: { colors?: MarkColors; stack?: boolean; word?: boolean }) {
  return (
    <span className={stack ? "lockup stacked" : "lockup"}>
      <Mark {...colors} />
      {word && <b>pacioli</b>}
    </span>
  );
}

function Example({
  kind,
  label,
  className,
  children,
  i,
}: {
  kind: VerdictKind;
  label: string;
  className: string;
  children: ReactNode;
  i: number;
}) {
  return (
    <figure className="example" data-reveal="up" style={delay(i)}>
      <div className={`example-tile ${className}`}>{children}</div>
      <figcaption>
        <Verdict kind={kind} />
        <span>{label}</span>
      </figcaption>
    </figure>
  );
}

const VARIANTS: { label: string; className: string; colors?: MarkColors }[] = [
  { label: "On blueprint navy: lime tile", className: "blueprint", colors: { tile: "#D4FF3A", ink: "#0E1B3D" } },
  { label: "On signal lime: navy tile", className: "on-lime" },
  { label: "On white or paper: navy tile", className: "on-white" },
  { label: "Cobalt tile, white P, lime rule", className: "on-white", colors: { tile: "#2A5BFF", ink: "#FFFFFF", rule: "#D4FF3A" } },
];

const MIN_SIZES = [64, 48, 32, 24, 20];

/** Clear space drawn as a technical drawing: x is the tile's corner radius. */
function ClearSpace() {
  return (
    <svg className="spec-drawing" viewBox="0 0 132 132" role="img" aria-labelledby="clear-title">
      <title id="clear-title">Clear space: one quarter of the tile on every side</title>
      <rect className="spec-zone" x="30" y="30" width="72" height="72" rx="4" />
      <svg x="42" y="42" width="48" height="48">
        <Mark />
      </svg>
      <g className="spec-dim">
        <path d="M30 20H42M30 17V23M42 17V23" />
        <text x="36" y="13">x</text>
        <path d="M90 112H102M90 109V115M102 109V115" />
        <text x="96" y="127">x</text>
        <path d="M20 90V102M17 90H23M17 102H23" />
        <text x="11" y="98.5">x</text>
        <path d="M112 30V42M109 30H115M109 42H115" />
        <text x="121" y="38.5">x</text>
        <path d="M42 66H90" className="faint" />
        <path d="M66 42V90" className="faint" />
      </g>
    </svg>
  );
}

export function LogoSection() {
  return (
    <section className="section" id="logo">
      <div className="wrap">
        <SectionHead n="01" label="Logo" title={<>The mark, <em className="serif">ruled twice.</em></>}>
          A P over the accountant's double rule: the line drawn under a column once it balances. The
          upper rule takes the ink color, the lower one is always coral.
        </SectionHead>

        <h3 className="sub" data-reveal="up">Color variants</h3>
        <div className="variants">
          {VARIANTS.map((v, i) => (
            <Example key={v.label} kind="do" label={v.label} className={v.className} i={i}>
              <Lockup colors={v.colors} />
            </Example>
          ))}
        </div>

        <div className="spec-row">
          <article className="card spec" data-reveal="up">
            <header>
              <h3>Clear space</h3>
              <p>
                <code>x</code> equals the tile's corner radius, a quarter of the mark. Keep it empty
                on every side.
              </p>
            </header>
            <ClearSpace />
          </article>
          <article className="card spec" data-reveal="up" style={delay(1)}>
            <header>
              <h3>Minimum size</h3>
              <p>
                The mark holds down to <code>20 px</code>. Below that the double rule closes up; use
                the favicon file instead.
              </p>
            </header>
            <div className="sizes">
              {MIN_SIZES.map((s) => (
                <figure key={s}>
                  <span className="size-box" style={{ width: s, height: s }}>
                    <Mark />
                  </span>
                  <figcaption>
                    {s} px{s === 20 && <em> min</em>}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="spec-foot">Lockup with wordmark: at least 96 px wide.</p>
          </article>
        </div>

        <h3 className="sub" data-reveal="up">Lockups</h3>
        <div className="lockups">
          <figure className="card" data-reveal="up" style={delay(0)}>
            <div className="lockup-stage">
              <Lockup />
            </div>
            <figcaption>
              <b>Horizontal</b>
              <span>Default. Nav, footer, documents.</span>
            </figcaption>
          </figure>
          <figure className="card" data-reveal="up" style={delay(1)}>
            <div className="lockup-stage">
              <Lockup stack />
            </div>
            <figcaption>
              <b>Stacked</b>
              <span>Square spaces: avatars, stickers, covers.</span>
            </figcaption>
          </figure>
          <figure className="card" data-reveal="up" style={delay(2)}>
            <div className="lockup-stage">
              <Lockup word={false} />
            </div>
            <figcaption>
              <b>Mark only</b>
              <span>Favicon, app icon, where the name is already said.</span>
            </figcaption>
          </figure>
        </div>

        <h3 className="sub" data-reveal="up">Please don't</h3>
        <div className="variants donts">
          <Example kind="dont" label="Stretch or squash it" className="on-white dont-stretch" i={0}>
            <Lockup />
          </Example>
          <Example kind="dont" label="Recolor it off-palette" className="on-white" i={1}>
            <Lockup colors={{ tile: "#FF5B3A", ink: "#FFD9A8", rule: "#2A5BFF" }} />
          </Example>
          <Example kind="dont" label="Rotate or tilt it" className="on-white dont-rotate" i={2}>
            <Lockup />
          </Example>
          <Example kind="dont" label="Set it on a busy picture" className="dont-busy" i={3}>
            <Lockup />
          </Example>
        </div>
      </div>
    </section>
  );
}
