import { Footer, Mark, Nav } from "../ui/Shell.tsx";

const COLORS = [
  { name: "Blueprint navy", hex: "#0E1B3D", use: "Paper for drawings, headings, the total row", ink: "#F3F2EC" },
  { name: "Cobalt", hex: "#2A5BFF", use: "Actions, grid lines, links", ink: "#FFFFFF" },
  { name: "Signal lime", hex: "#D4FF3A", use: "The one highlight: nav, tags, the double rule", ink: "#0E1B3D" },
  { name: "Coral", hex: "#FF5B3A", use: "What leaves the books: errors, refunds", ink: "#FFFFFF" },
  { name: "Peach", hex: "#FFD9A8", use: "Paper slips inside illustrations", ink: "#0E1B3D" },
  { name: "Drafting paper", hex: "#F3F2EC", use: "Page background under the grid", ink: "#0E1B3D" },
];

const ART = ["hero", "sign", "vault", "balance", "meter", "stamp", "envelope", "witness", "portrait"];

const VOICE: [string, string][] = [
  ["The rest goes back to the payer.", "Seamless refunds powered by smart escrow."],
  ["One signature opens the tab.", "Frictionless one-click onboarding."],
  ["The books balance after every call.", "Bank-grade security you can trust."],
];

export function Brand() {
  return (
    <>
      <Nav current="/brand/" />
      <main className="wrap brand">
        <section className="brand-hero">
          <span className="tag">Brand kit</span>
          <h1>
            A ledger, drawn <em className="serif">on blueprint paper.</em>
          </h1>
          <p>
            Pacioli is named for the mathematician who first printed double-entry bookkeeping. The
            brand pairs an accountant's ledger with an engineer's drawing: exact, ruled, and a little
            bit loud.
          </p>
        </section>

        <section>
          <h2>Logo</h2>
          <p className="note">
            The mark is a P over the accountant's double rule: the line drawn under a column once it
            balances. The upper rule is lime, the lower coral.
          </p>
          <div className="logo-grid">
            <div className="tile blueprint">
              <span className="big-logo">
                <Mark tile="#D4FF3A" ink="#0E1B3D" />
                <b>pacioli</b>
              </span>
            </div>
            <div className="tile lime-tile">
              <span className="big-logo">
                <Mark />
                <b>pacioli</b>
              </span>
            </div>
            <div className="tile paper-tile">
              <span className="big-logo">
                <Mark tile="#2A5BFF" ink="#FFFFFF" rule="#D4FF3A" />
                <b>pacioli</b>
              </span>
            </div>
            <div className="tile construction">
              <div className="mark-xl">
                <Mark />
                <i className="m h" />
                <i className="m v" />
              </div>
              <small>Clear space: one rule height on every side. Minimum size 20 px.</small>
            </div>
          </div>
          <div className="downloads">
            <a className="button ghost" href="/favicon.svg" download>
              Mark (SVG)
            </a>
            <a className="button ghost" href="/og.png" download>
              Social card (PNG)
            </a>
            <a className="button ghost" href="/banner/">
              README banner
            </a>
          </div>
        </section>

        <section>
          <h2>Color</h2>
          <div className="swatches">
            {COLORS.map((c) => (
              <article key={c.hex} style={{ background: c.hex, color: c.ink }}>
                <b>{c.name}</b>
                <code>{c.hex}</code>
                <small>{c.use}</small>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Type</h2>
          <div className="type-grid">
            <article className="card">
              <small>Display and text · Bricolage Grotesque</small>
              <p className="type-display">Every payment, booked twice.</p>
            </article>
            <article className="card">
              <small>Accent · Instrument Serif Italic</small>
              <p className="type-serif">what you signed for.</p>
            </article>
            <article className="card">
              <small>Numbers and code · JetBrains Mono</small>
              <p className="type-mono">held 57.50 + charged 42.50 = 100.00</p>
            </article>
          </div>
        </section>

        <section>
          <h2>Illustration</h2>
          <p className="note">
            Bold ink outlines, halftone shading and the six brand colors, annotated like a technical
            drawing: dimension lines, center marks, construction circles. No text inside pictures.
          </p>
          <div className="art-grid">
            {ART.map((name) => (
              <img key={name} src={`/art/${name}.webp`} alt={name} loading="lazy" className={name} />
            ))}
          </div>
        </section>

        <section>
          <h2>Voice</h2>
          <p className="note">Say what the contract does. Short sentences, real numbers, no hype.</p>
          <div className="voice">
            {VOICE.map(([yes, no]) => (
              <div key={yes}>
                <p className="yes">{yes}</p>
                <p className="no">{no}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
