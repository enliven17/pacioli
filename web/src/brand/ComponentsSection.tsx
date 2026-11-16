import type { ReactNode } from "react";
import { Code } from "../ui/Code.tsx";
import { Mark } from "../ui/Shell.tsx";
import { SectionHead, delay } from "./Head.tsx";

const TOKENS = `:root {
  --navy: #0e1b3d;   /* drawings, headings */
  --cobalt: #2a5bff; /* actions, grid */
  --lime: #d4ff3a;   /* the one highlight */
  --coral: #ff5b3a;  /* money leaving */
  --peach: #ffd9a8;
  --paper: #f3f2ec;
  --display: "Bricolage Grotesque Variable";
  --serif: "Instrument Serif";
  --mono: "JetBrains Mono";
  --radius: 22px;
}`;

const ROWS = [
  { date: "09:41", what: "Tab opened, Permit2", amount: "100.00", kind: "in" },
  { date: "09:52", what: "Charge #1, 312 calls", amount: "−30.00", kind: "out" },
  { date: "10:07", what: "Charge #2, 125 calls", amount: "−12.50", kind: "out" },
  { date: "10:15", what: "Returned to payer", amount: "−57.50", kind: "back" },
];

function Specimen({ label, children, className = "", i }: { label: string; children: ReactNode; className?: string; i: number }) {
  return (
    <figure className={`card comp ${className}`} data-reveal="up" style={delay(i)}>
      <figcaption>{label}</figcaption>
      <div className="comp-body">{children}</div>
    </figure>
  );
}

export function ComponentsSection() {
  return (
    <section className="section" id="components">
      <div className="wrap">
        <SectionHead n="05" label="Components" title={<>Parts, <em className="serif">rendered live.</em></>}>
          These are the real components from the site, not pictures of them. Corners are 12 px on
          controls, 22 px on cards.
        </SectionHead>

        <div className="comps">
          <Specimen label="Buttons" i={0}>
            <div className="comp-row">
              <button>Open a tab</button>
              <button className="lime">Sign</button>
              <button className="ghost">Read the docs</button>
              <button disabled>Settled</button>
            </div>
          </Specimen>

          <Specimen label="Tags" i={1}>
            <div className="comp-row">
              <span className="tag">held</span>
              <span className="tag cobalt">charged</span>
              <span className="tag coral">returned</span>
              <span className="tag">
                <b className="tag-n">05</b> numbered
              </span>
            </div>
          </Specimen>

          <Specimen label="Card" i={2} className="comp-card-spec">
            <article className="card tab-card">
              <header>
                <Mark />
                <span>
                  <b>Tab #0042</b>
                  <small>Open · 0xA0b8…c3F2</small>
                </span>
                <span className="tag">open</span>
              </header>
              <div className="tab-amount">
                <span>Held</span>
                <b>100.00</b>
              </div>
              <div className="tab-meter" role="progressbar" aria-label="Charged so far" aria-valuenow={42.5} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: "42.5%" }} />
              </div>
              <small className="tab-foot">42.50 charged · 57.50 left</small>
            </article>
          </Specimen>

          <Specimen label="Ledger with total row" i={3} className="comp-ledger-spec">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Entry</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.date} className={r.kind}>
                    <td>{r.date}</td>
                    <td>{r.what}</td>
                    <td>{r.amount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    Balance
                  </th>
                  <td>0.00</td>
                </tr>
              </tfoot>
            </table>
          </Specimen>

          <Specimen label="Code block" i={4} className="comp-code-spec">
            <Code title="tokens.css" marks={[4]} plain>
              {TOKENS}
            </Code>
          </Specimen>
        </div>
      </div>
    </section>
  );
}
