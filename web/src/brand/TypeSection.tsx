import type { CSSProperties } from "react";
import { TYPE_SCALE, type TypeStep } from "./data.ts";
import { SectionHead, delay } from "./Head.tsx";

const FAMILIES = [
  {
    id: "display",
    name: "Bricolage Grotesque",
    role: "Display and text",
    weights: "400 · 600 · 700 · 800",
    glyph: "Aa",
    set: "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789",
    note: "Headlines at 800 with tight tracking (−0.035em). Text at 400.",
  },
  {
    id: "serif",
    name: "Instrument Serif",
    role: "Accent, italic only",
    weights: "400 italic",
    glyph: "Aa",
    set: "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz",
    note: "Two or three words per headline, never a whole paragraph.",
  },
  {
    id: "mono",
    name: "JetBrains Mono",
    role: "Numbers, code, labels",
    weights: "400 · 500",
    glyph: "0x",
    set: "0123456789 +−×÷= .,:; 0xA0b8…c3F2 {} [] ()",
    note: "Every amount, address and hash. Tabular figures, always.",
  },
];

function stepStyle(s: TypeStep): CSSProperties {
  return {
    fontFamily: `var(--${s.family})`,
    fontSize: `min(${s.size}px, ${s.vw}vw)`,
    lineHeight: s.line,
    fontWeight: s.weight,
    fontStyle: s.family === "serif" ? "italic" : undefined,
    letterSpacing: s.family === "display" && s.size >= 40 ? "-0.04em" : s.family === "mono" ? "0.08em" : undefined,
  };
}

export function TypeSection() {
  return (
    <section className="section" id="type">
      <div className="wrap">
        <SectionHead n="03" label="Type" title={<>A grotesk that shouts, <em className="serif">a serif that whispers.</em></>}>
          Three families, each with one job. Bricolage carries the voice, Instrument Serif adds the
          hand-written margin note, JetBrains Mono keeps every number in its column.
        </SectionHead>

        <div className="families">
          {FAMILIES.map((f, i) => (
            <article key={f.id} className={`card family fam-${f.id}`} data-reveal="up" style={delay(i)}>
              <header>
                <span className="family-role">{f.role}</span>
                <h3>{f.name}</h3>
              </header>
              <p className="family-glyph" aria-hidden="true">
                {f.glyph}
              </p>
              <p className="family-set">{f.set}</p>
              <dl>
                <div>
                  <dt>Weights</dt>
                  <dd>{f.weights}</dd>
                </div>
                <div>
                  <dt>Token</dt>
                  <dd>
                    <code>var(--{f.id})</code>
                  </dd>
                </div>
              </dl>
              <p className="family-note">{f.note}</p>
            </article>
          ))}
        </div>

        <h3 className="sub" data-reveal="up">Scale</h3>
        <ol className="scale card" data-reveal="up">
          {TYPE_SCALE.map((s) => (
            <li key={s.name}>
              <span className="scale-meta">
                <b>{s.name}</b>
                <code>
                  {s.size} / {s.line} · {s.weight}
                </code>
              </span>
              <span className="scale-sample" style={stepStyle(s)}>
                {s.sample}
              </span>
            </li>
          ))}
        </ol>

        <h3 className="sub" data-reveal="up">In use</h3>
        <article className="editorial" data-reveal="scale">
          <header className="editorial-head">
            <span className="editorial-kicker">Entry no. 1494</span>
            <span className="editorial-kicker">Venice · Summa de arithmetica</span>
          </header>
          <h3 className="editorial-title">
            Every payment, <em className="serif">booked twice.</em>
          </h3>
          <div className="editorial-body">
            <p className="editorial-lead">
              A payer signs once. Pacioli holds the money, books each charge as it happens, and sends
              the rest back <em className="serif">the moment the tab closes.</em>
            </p>
            <table className="editorial-figures">
              <caption className="sr-only">One tab, settled</caption>
              <tbody>
                <tr>
                  <th scope="row">Held</th>
                  <td>100.00</td>
                </tr>
                <tr>
                  <th scope="row">Charged</th>
                  <td>−42.50</td>
                </tr>
                <tr className="total">
                  <th scope="row">Returned</th>
                  <td>57.50</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
