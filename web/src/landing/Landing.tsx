import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useInView } from "../ui/motion.ts";
import { Footer, Nav, REPO } from "../ui/Shell.tsx";
import { FeSection } from "./FeSection.tsx";
import { Ledger } from "./Ledger.tsx";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

const MARQUEE = [
  "Written in Fe",
  "Permit2 witness",
  "ERC-3009",
  "ERC-1271 wallets",
  "Metered receipts",
  "Double-entry ledger",
  "Live on Sepolia",
];

const STEPS = [
  {
    art: "/art/sign.webp",
    tag: "01. Sign",
    title: "One signature opens the tab.",
    body: "The payer signs an EIP-712 authorization: merchant, token, limit, two deadlines and whether the tab is metered. The tab id is its digest, so it opens exactly one tab.",
  },
  {
    art: "/art/vault.webp",
    tag: "02. Hold",
    title: "The limit waits in escrow.",
    body: "Opening moves the limit into the contract and checks every unit arrived. Until the capture deadline, the merchant charges what was used, in as many parts as it needs.",
  },
  {
    art: "/art/balance.webp",
    tag: "03. Settle",
    title: "The rest goes back. Always.",
    body: "The merchant closes the tab, or after the deadline anyone can. The remainder returns to the payer, never anywhere else, and the books balance at every step.",
  },
];

const SOURCES = [
  {
    art: "/art/stamp.webp",
    name: "Allowance",
    call: "open",
    body: "The payer approves the escrow and signs the tab digest, from an EOA or any ERC-1271 wallet.",
    signatures: "approve + 1 signature",
  },
  {
    art: "/art/envelope.webp",
    name: "ERC-3009",
    call: "openWithErc3009",
    body: "For USDC-style tokens. The ERC-3009 nonce is the tab id, so one signature funds exactly these terms. No approval.",
    signatures: "1 signature, gasless",
  },
  {
    art: "/art/witness.webp",
    name: "Permit2",
    call: "openWithPermit2",
    body: "For any ERC-20. The authorization rides along as the Permit2 witness, so the signature that moves the tokens also states the terms.",
    signatures: "1 signature per tab",
  },
];

/** Counts up to `to` once visible. */
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.6);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, to]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
}

/** Pay upfront vs a tab, as two bars that settle when scrolled into view. */
function Compare() {
  const [ref, seen] = useInView<HTMLDivElement>(0.45);
  return (
    <div className={seen ? "versus on" : "versus"} ref={ref}>
      <article className="card">
        <span className="tag coral">Pay upfront</span>
        <div className="bar-track">
          <i className="paid" style={{ width: "100%" }}>
            <span>100.00 to the merchant</span>
          </i>
        </div>
        <dl>
          <div>
            <dt>Real cost</dt>
            <dd>42.50</dd>
          </div>
          <div>
            <dt>The other 57.50</dt>
            <dd>When the merchant sends it</dd>
          </div>
          <div>
            <dt>Signatures</dt>
            <dd>One per payment</dd>
          </div>
        </dl>
      </article>
      <article className="card good">
        <span className="tag">With Pacioli</span>
        <div className="bar-track">
          <i className="charged">
            <span>42.50</span>
          </i>
          <i className="released">
            <span>57.50 back</span>
          </i>
        </div>
        <dl>
          <div>
            <dt>Real cost</dt>
            <dd>42.50 charged</dd>
          </div>
          <div>
            <dt>The other 57.50</dt>
            <dd>Returned by the contract</dd>
          </div>
          <div>
            <dt>Signatures</dt>
            <dd>One per tab</dd>
          </div>
        </dl>
      </article>
    </div>
  );
}

/** Receipts that print one after another when visible. */
function Receipts() {
  const [ref, seen] = useInView<HTMLOListElement>(0.5);
  return (
    <ol className={seen ? "receipts on" : "receipts"} ref={ref}>
      <li style={delay(0)}>
        <span>Receipt</span> total 10.00 <b>pays 10.00</b>
      </li>
      <li style={delay(500)}>
        <span>Receipt</span> total 25.00 <b>pays 15.00</b>
      </li>
      <li style={delay(1000)}>
        <span>Receipt</span> total 31.20 <b>pays 6.20</b>
      </li>
      <li className="stale" style={delay(1500)}>
        <span>Replay</span> total 25.00 <b>StaleReceipt</b>
      </li>
    </ol>
  );
}

export function Landing() {
  return (
    <>
      <Nav current="/" />

      <main>
        <section className="hero wrap">
          <span className="tag rise" style={delay(0)}>
            Auth-capture escrow, written in Fe
          </span>
          <h1>
            <span className="rise" style={delay(80)}>
              Every payment,
            </span>
            <span className="rise" style={delay(200)}>
              booked <em className="serif">twice.</em>
            </span>
          </h1>
          <p className="rise" style={delay(340)}>
            Pacioli holds a payment like a card does: one signature opens a tab, the merchant
            charges what was used, and the rest goes back. Every movement posts to two accounts,
            and the books always balance.
          </p>
          <div className="cta rise" style={delay(460)}>
            <a className="button" href="/app/">
              Open a tab
            </a>
            <a className="button ghost" href="/docs/">
              Read the docs
            </a>
          </div>
          <figure className="hero-art rise" style={delay(560)}>
            <img
              src="/art/hero.webp"
              alt="A ledger on blueprint paper. A hand signs a slip, coins flow into a vault and part of them return."
              width="1536"
              height="1024"
            />
          </figure>
        </section>

        <div className="marquee" aria-hidden="true">
          <div>
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <span key={i}>
                {item}
                <i>✦</i>
              </span>
            ))}
          </div>
        </div>

        <section className="section wrap compare">
          <div className="compare-copy" data-reveal="left">
            <span className="tag cobalt">The problem</span>
            <h2>
              Pay for what
              <br />
              was <em className="serif">used.</em>
            </h2>
            <p>
              Hotels, rides and metered APIs hold an amount first and charge the real cost later.
              On-chain payments usually move everything at once, so the payer either overpays and
              waits for a refund or signs again for every charge.
            </p>
          </div>
          <div data-reveal="right">
            <Compare />
          </div>
        </section>

        <section className="section wrap" id="how">
          <div className="section-head" data-reveal>
            <span className="tag">How it works</span>
            <h2>
              So, how does
              <br />a tab work?
            </h2>
            <p>Three steps, one signature, and a contract that only ever sends the rest home.</p>
          </div>
          <div className="steps">
            <svg className="steps-line" viewBox="0 0 1000 20" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 10 H1000" />
            </svg>
            {STEPS.map((step, i) => (
              <article className="card step" key={step.tag} data-reveal style={delay(i * 150)}>
                <div className="art">
                  <img src={step.art} alt="" width="720" height="720" loading="lazy" />
                </div>
                <span className="tag">{step.tag}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section wrap" id="funding">
          <div className="section-head" data-reveal>
            <span className="tag">Funding</span>
            <h2>
              Three ways in.
              <br />
              One ledger.
            </h2>
            <p>
              Each funding source implements the same <code>Funding</code> trait. The contract opens
              every tab through one generic path, then checks that the full limit arrived.
            </p>
          </div>
          <div className="source-cards">
            {SOURCES.map((source, i) => (
              <article className="card source" key={source.name} data-reveal style={delay(i * 150)}>
                <div className="art">
                  <img src={source.art} alt="" width="720" height="720" loading="lazy" />
                </div>
                <div className="source-copy">
                  <h3>{source.name}</h3>
                  <code>{source.call}</code>
                  <p>{source.body}</p>
                  <span className="tag cobalt">{source.signatures}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section wrap">
          <div className="metered-card blueprint" data-reveal="scale">
            <div className="metered-copy">
              <span className="tag">Metered tabs</span>
              <h2>
                The merchant charges
                <br />
                <em className="serif">what you signed for.</em>
              </h2>
              <p>
                On a metered tab the merchant cannot charge on its own word. The payer signs
                receipts for a running total and anyone can submit the latest one: the contract
                pays the difference and nothing more. An old receipt is worth zero.
              </p>
              <Receipts />
            </div>
            <div className="metered-art">
              <img src="/art/meter.webp" alt="" width="720" height="720" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="section wrap" id="ledger">
          <div className="section-head" data-reveal>
            <span className="tag">Double entry</span>
            <h2>
              The books always
              <br />
              <em className="serif">balance.</em>
            </h2>
            <p>
              A tab keeps four accounts and every call posts a debit and a credit, so{" "}
              <code>limit = held + charged + released</code> holds after every step. Watch a tab
              run, then post your own entries.
            </p>
          </div>
          <div data-reveal="scale">
            <Ledger />
          </div>
        </section>

        <section className="section wrap" id="fe">
          <div className="section-head" data-reveal>
            <span className="tag">Built in Fe</span>
            <h2>
              The compiler keeps
              <br />
              the books <em className="serif">honest.</em>
            </h2>
            <p>
              Fe checks effects, traits and ABI types at compile time. Four features carry the
              design; pick one.
            </p>
          </div>
          <div data-reveal>
            <FeSection />
          </div>
          <ul className="facts">
            <li data-reveal style={delay(0)}>
              <b>
                <Count to={5} />
              </b>
              accounts per tab, every movement posted to two of them
            </li>
            <li data-reveal style={delay(120)}>
              <b>
                <Count to={3} />
              </b>
              funding sources, run against the real Permit2 bytecode
            </li>
            <li data-reveal style={delay(240)}>
              <b>
                <Count to={0} />
              </b>
              nonce storage: the tab id is the authorization digest
            </li>
          </ul>
        </section>

        <section className="section wrap why">
          <div className="why-art" data-reveal="left">
            <img src="/art/portrait.webp" alt="" width="900" height="1124" loading="lazy" />
          </div>
          <div className="why-copy" data-reveal="right">
            <span className="tag">Why the name</span>
            <h2>Luca Pacioli, 1494.</h2>
            <p>
              The Franciscan mathematician Luca Pacioli wrote the first printed description of
              double-entry bookkeeping in his <em className="serif">Summa de arithmetica</em>. Every
              entry is recorded twice, as a debit and a credit, and a column is closed with a double
              rule once it balances.
            </p>
            <p>
              The mark is that double rule under a P. A tab is a small ledger: held, charged, released
              and refunded, posted in pairs and closed only when the remainder is home.
            </p>
            <ol className="timeline">
              <li>
                <b>1494</b> Summa de arithmetica
              </li>
              <li>
                <b>2026</b> Pacioli, in Fe
              </li>
            </ol>
            <a className="button ghost" href={REPO}>
              Read the contract
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
