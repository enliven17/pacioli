import { Footer, Nav, REPO } from "../ui/Shell.tsx";
import { Ledger } from "./Ledger.tsx";

const STEPS = [
  {
    art: "/art/sign.webp",
    tag: "01. Sign",
    title: "One signature opens the tab.",
    body: "The payer signs an EIP-712 authorization: merchant, token, limit, two deadlines and whether the tab is metered. Anyone can submit it; the tab id is its digest, so it opens exactly one tab.",
  },
  {
    art: "/art/vault.webp",
    tag: "02. Hold",
    title: "The limit waits in escrow.",
    body: "Opening the tab moves the limit into the contract and checks that every unit arrived. Until the capture deadline, the merchant charges what was used, in as many parts as it needs.",
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
    body: "The payer approves the escrow once and signs the tab digest, from an EOA or any ERC-1271 wallet.",
    signatures: "approve + 1 signature",
  },
  {
    art: "/art/envelope.webp",
    name: "ERC-3009",
    call: "openWithErc3009",
    body: "For USDC-style tokens. The payer signs a ReceiveWithAuthorization whose nonce is the tab id, so one signature funds these exact terms. No approval.",
    signatures: "1 signature, gasless",
  },
  {
    art: "/art/witness.webp",
    name: "Permit2",
    call: "openWithPermit2",
    body: "For any ERC-20. The authorization rides along as a Permit2 witness, so the signature that moves the tokens also states the terms.",
    signatures: "1 signature per tab",
  },
];

const FE_USES = `Refund { id, amount }
    uses (ctx, mut call, terms, charged, mut refunded, mut log)
{
    // \`held\` is not listed: a refund cannot touch the escrow.
    ...
}`;

const FE_TRAIT = `pub trait Funding {
    fn collect(self, auth: Authorization, id: u256, escrow: Address)
        uses (ctx: Ctx, call: mut Call)
}

impl Funding for Allowance { ... }
impl Funding for Erc3009 { ... }
impl Funding for Permit2 { ... }

fn fund<F: Funding>(_ source: F, auth: Authorization, id: u256)
    uses (ctx: Ctx, call: mut Call)
{
    let before = balance_of(token: auth.token, account: ctx.address())
    source.collect(auth, id, escrow: ctx.address())
    if balance_of(...) - before != auth.limit { revert_error(ShortFunding {}) }
}`;

const FE_ERROR = `error[8-0116]: contract field \`held\` is not in this handler's \`uses\`
    │
    │             held.set(key: id, value: 0)
    │             ^^^^ \`held\` is not reachable here`;

export function Landing() {
  return (
    <>
      <Nav current="/" />

      <main>
        <section className="hero wrap">
          <span className="tag">Auth-capture escrow, written in Fe</span>
          <h1>
            Every payment,
            <br />
            booked <em className="serif">twice.</em>
          </h1>
          <p>
            Pacioli holds a payment like a card does: one signature opens a tab, the merchant
            charges what was used, and the rest goes back. Every movement posts to two accounts,
            and the books always balance.
          </p>
          <div className="cta">
            <a className="button" href="/app/">
              Open a tab
            </a>
            <a className="button ghost" href="/docs/">
              Read the docs
            </a>
          </div>
          <figure className="hero-art blueprint">
            <img
              src="/art/hero.webp"
              alt="A ledger on blueprint paper. A hand signs a slip, coins flow into a vault and part of them return."
              width="1536"
              height="1024"
            />
          </figure>
        </section>

        <section className="compare wrap">
          <div className="lead">
            <h2>
              Pay for what
              <br />
              was used.
            </h2>
            <p>
              Hotels, rides and metered APIs hold an amount first and charge the real cost later.
              On-chain payments usually move everything at once, so the payer either overpays and
              waits for a refund or signs again for every charge.
            </p>
          </div>
          <div className="compare-cards">
            <article className="card">
              <span className="tag coral">Pay upfront</span>
              <dl>
                <div>
                  <dt>Moves at the start</dt>
                  <dd>100.00 to the merchant</dd>
                </div>
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
              <dl>
                <div>
                  <dt>Moves at the start</dt>
                  <dd>100.00 into escrow</dd>
                </div>
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
        </section>

        <section className="how wrap" id="how">
          <h2 className="center">
            So, how does
            <br />a tab work?
          </h2>
          <div className="steps">
            {STEPS.map((step) => (
              <article className="card step" key={step.tag}>
                <img src={step.art} alt="" width="720" height="720" loading="lazy" />
                <span className="tag">{step.tag}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="sources wrap" id="funding">
          <div className="lead">
            <h2>Three ways in. One ledger.</h2>
            <p>
              Each funding source implements the same <code>Funding</code> trait. The contract
              opens every tab through one generic path, then checks that the full limit arrived.
            </p>
          </div>
          <div className="source-cards">
            {SOURCES.map((source) => (
              <article className="card source" key={source.name}>
                <img src={source.art} alt="" width="720" height="720" loading="lazy" />
                <div>
                  <h3>{source.name}</h3>
                  <code>{source.call}</code>
                  <p>{source.body}</p>
                  <span className="tag cobalt">{source.signatures}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="metered wrap">
          <div className="metered-card blueprint">
            <div>
              <span className="tag">Metered tabs</span>
              <h2>
                The merchant charges
                <br />
                <em className="serif">what you signed for.</em>
              </h2>
              <p>
                On a metered tab the merchant cannot charge on its own word. The payer signs
                receipts for a running total, and anyone can submit the latest one: the contract
                pays the merchant the difference and nothing more. An old receipt is worth zero.
              </p>
              <ol className="receipts">
                <li>
                  <span>Receipt</span> total 10.00 <b>pays 10.00</b>
                </li>
                <li>
                  <span>Receipt</span> total 25.00 <b>pays 15.00</b>
                </li>
                <li className="stale">
                  <span>Replay</span> total 25.00 <b>StaleReceipt</b>
                </li>
              </ol>
            </div>
            <img src="/art/meter.webp" alt="" width="720" height="720" loading="lazy" />
          </div>
        </section>

        <section className="ledger-section wrap" id="ledger">
          <div className="lead">
            <span className="tag">Double entry</span>
            <h2>The books always balance.</h2>
            <p>
              A tab keeps four accounts. Each call posts one debit and one credit, so
              <code> limit = held + charged + released </code>
              holds after every step, and refunds never exceed charges. The test suite checks it
              after every step of random sequences. Try it:
            </p>
          </div>
          <Ledger />
        </section>

        <section className="fe wrap" id="fe">
          <div className="lead">
            <span className="tag">Built in Fe</span>
            <h2>The compiler keeps the books honest.</h2>
            <p>
              Every handler lists the state and capabilities it may touch, and the compiler
              enforces the list. Funding sources are a trait, and the open path is generic over
              it.
            </p>
          </div>
          <div className="code-grid">
            <figure className="code blueprint">
              <figcaption>Effects: a refund cannot touch the escrow</figcaption>
              <pre>{FE_USES}</pre>
              <pre className="error">{FE_ERROR}</pre>
            </figure>
            <figure className="code blueprint">
              <figcaption>A trait for funding, one generic open path</figcaption>
              <pre>{FE_TRAIT}</pre>
            </figure>
          </div>
          <ul className="facts">
            <li>
              <b>26</b> Fe tests, with typed-data vectors from viem and cast
            </li>
            <li>
              <b>3</b> funding sources, checked against the real Permit2 bytecode
            </li>
            <li>
              <b>0</b> nonce storage: the tab id is the authorization digest
            </li>
          </ul>
        </section>

        <section className="why wrap">
          <img src="/art/portrait.webp" alt="" width="900" height="1124" loading="lazy" />
          <div>
            <span className="tag">Why the name</span>
            <h2>Luca Pacioli, 1494.</h2>
            <p>
              The Franciscan mathematician Luca Pacioli wrote the first printed description of
              double-entry bookkeeping in his <em className="serif">Summa de arithmetica</em>.
              Every entry is recorded twice, as a debit and a credit, and a column is closed with a
              double rule once it balances.
            </p>
            <p>
              The mark is that double rule under a P. A tab is a small ledger: held, charged,
              released and refunded, posted in pairs and closed only when the remainder is home.
            </p>
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
