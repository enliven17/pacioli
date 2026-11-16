import type { CSSProperties, ReactNode } from "react";

/** Numbered section heading, like an entry in the ledger: "01 · Logo". */
export function SectionHead({ n, label, title, children }: { n: string; label: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="section-head">
      <span className="tag" data-reveal="up">
        <b className="tag-n">{n}</b> {label}
      </span>
      <h2 data-reveal="up" style={{ "--delay": "60ms" } as CSSProperties}>
        {title}
      </h2>
      {children && (
        <p data-reveal="up" style={{ "--delay": "120ms" } as CSSProperties}>
          {children}
        </p>
      )}
    </header>
  );
}

export type VerdictKind = "do" | "dont" | "say" | "not";

const VERDICT_LABEL: Record<VerdictKind, string> = { do: "Do", dont: "Don't", say: "Say", not: "Not" };

/** A small pill that labels an example. Always its own element, never glued to the text. */
export function Verdict({ kind }: { kind: VerdictKind }) {
  return <span className={`verdict ${kind}`}>{VERDICT_LABEL[kind]}</span>;
}

/** Stagger helper for `data-reveal` siblings. */
export function delay(i: number, step = 70): CSSProperties {
  return { "--delay": `${i * step}ms` } as CSSProperties;
}
