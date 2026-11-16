import { useEffect, useState, type CSSProperties } from "react";
import { useInView } from "../ui/motion.ts";
import { COLORS, PAIRINGS, contrast, grade, hexToRgb, inkFor, type Swatch } from "./data.ts";
import { SectionHead, delay } from "./Head.tsx";

const NAME_BY_HEX = new Map([...COLORS.map((c) => [c.hex, c.name] as const), ["#FFFFFF", "White"]]);

/** Copies text and remembers which value was copied for ~1.4 s. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1400);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setCopied(null);
    }
  };
  return [copied, copy] as const;
}

function SwatchCard({ c, copied, onCopy, i }: { c: Swatch; copied: boolean; onCopy: () => void; i: number }) {
  const ink = inkFor(c.hex);
  const rgb = hexToRgb(c.hex).join(", ");
  return (
    <button
      className="swatch"
      style={{ background: c.hex, color: ink, ...delay(i) }}
      onClick={onCopy}
      aria-label={`${c.name}, ${c.hex}. Copy hex`}
      data-reveal="up"
    >
      <span className="swatch-top">
        <b>{c.name}</b>
        <span className="swatch-copy" aria-hidden="true">
          {copied ? "Copied" : "Copy"}
        </span>
      </span>
      <span className="swatch-values">
        <code>{c.hex}</code>
        <code>rgb {rgb}</code>
        <code>var(--{c.id})</code>
      </span>
      <small>{c.use}</small>
    </button>
  );
}

function Proportion() {
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  return (
    <div className="proportion" ref={ref}>
      <div className="proportion-bar" role="img" aria-label={COLORS.map((c) => `${c.name} ${c.share}%`).join(", ")}>
        {COLORS.map((c, i) => (
          <i
            key={c.id}
            style={{ "--w": seen ? `${c.share}%` : "0%", background: c.hex, transitionDelay: `${i * 90}ms` } as CSSProperties}
          />
        ))}
      </div>
      <ul className="proportion-legend">
        {COLORS.map((c) => (
          <li key={c.id}>
            <i style={{ background: c.hex }} />
            <span>{c.name}</span>
            <b>{c.share}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pairing({ fg, bg, note, i }: { fg: string; bg: string; note: string; i: number }) {
  const ratio = contrast(fg, bg);
  const g = grade(ratio);
  return (
    <figure className="pairing" data-reveal="up" style={delay(i, 50)}>
      <div className="pairing-sample" style={{ color: fg, background: bg }}>
        <span className="pairing-big">Aa</span>
        <span className="pairing-text">Booked twice.</span>
      </div>
      <figcaption>
        <span className="pairing-names">
          {NAME_BY_HEX.get(fg)} on {NAME_BY_HEX.get(bg)}
        </span>
        <span className="pairing-meta">
          <b className="pairing-ratio">{ratio.toFixed(2)}:1</b>
          <span className={`grade ${g === "Fail" ? "fail" : g === "AA Large" ? "large" : "pass"}`}>{g}</span>
        </span>
        <small>{note}</small>
      </figcaption>
    </figure>
  );
}

export function ColorSection() {
  const [copied, copy] = useCopy();
  return (
    <section className="section" id="color">
      <div className="wrap">
        <SectionHead n="02" label="Color" title={<>Six inks, <em className="serif">one signal.</em></>}>
          Mostly paper and navy, with cobalt for action. Lime is the only highlight on a page, coral
          only marks money leaving the books. Click a swatch to copy its hex.
        </SectionHead>

        <div className="swatches">
          {COLORS.map((c, i) => (
            <SwatchCard key={c.id} c={c} i={i} copied={copied === c.hex} onCopy={() => copy(c.hex)} />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? `Copied ${copied}` : ""}
        </p>

        <h3 className="sub" data-reveal="up">Proportion on a page</h3>
        <Proportion />

        <h3 className="sub" data-reveal="up">Accessible pairings</h3>
        <p className="sub-note" data-reveal="up">
          WCAG 2.2 contrast, computed live. AA needs 4.5:1 for body text, 3:1 for large text; AAA needs 7:1.
        </p>
        <div className="pairings">
          {PAIRINGS.map((p, i) => (
            <Pairing key={p.fg + p.bg} {...p} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
