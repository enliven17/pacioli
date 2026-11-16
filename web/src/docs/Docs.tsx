import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Code } from "../ui/Code.tsx";
import { Footer, Nav, REPO } from "../ui/Shell.tsx";
import { chain, pacioli, permit2, token } from "../wallet.ts";
import { FundingDiagram } from "./FundingDiagram.tsx";
import { LedgerDiagram } from "./LedgerDiagram.tsx";
import { ReceiptsDiagram } from "./ReceiptsDiagram.tsx";
import { SequenceDiagram } from "./SequenceDiagram.tsx";

const SECTIONS = [
  ["overview", "Overview"],
  ["flow", "The flow"],
  ["quickstart", "Quick start"],
  ["authorization", "The authorization"],
  ["funding", "Funding sources"],
  ["receipts", "Metered receipts"],
  ["ledger", "The ledger"],
  ["calls", "Calls and errors"],
  ["integrate", "Integrate with viem"],
  ["security", "Security and limits"],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

const stagger = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

function Table({
  head,
  rows,
  caption,
}: {
  head: string[];
  rows: ReactNode[][];
  caption: string;
}) {
  return (
    <div className="dtable" data-reveal="up">
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} data-label={head[j]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  lede,
  children,
}: {
  id: SectionId;
  n: number;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="dsec" aria-labelledby={`${id}-h`}>
      <header className="dsec-head">
        <span className="dimension" data-reveal="left">
          § {String(n).padStart(2, "0")}
        </span>
        <h2 id={`${id}-h`} data-reveal="up">
          {title}
        </h2>
        {lede && (
          <p className="lede" data-reveal="up" style={stagger(100)}>
            {lede}
          </p>
        )}
      </header>
      <div className="dsec-body">{children}</div>
    </section>
  );
}

const QUICKSTART = `anvil                      # local chain, in another terminal
fe test && fe build        # Fe 26.6.0
cd web && pnpm install
pnpm run deploy            # Pacioli, Demo Dollar, and Permit2 on Anvil
pnpm run e2e               # all three funding sources, receipts, reclaim
pnpm dev`;

const TYPED_DATA = `Authorization(
  address payer,
  address merchant,
  address token,
  uint256 limit,
  uint256 openBy,
  uint256 captureBy,
  bool    metered,
  uint256 nonce
)

domain: { name: "Pacioli", version: "1", chainId, verifyingContract: <Pacioli> }
tab id: the EIP-712 digest of the authorization`;

const FUNDING = `pub trait Funding {
    fn collect(self, auth: Authorization, id: u256, escrow: Address)
    uses (ctx: Ctx, call: mut Call)
}

fn fund<F: Funding>(_ source: F, auth: Authorization, id: u256)
uses (ctx: Ctx, call: mut Call)
{
    let escrow = ctx.address()
    let before = balance_of(token: auth.token, account: escrow)
    source.collect(auth, id, escrow)
    if balance_of(token: auth.token, account: escrow) - before != auth.limit {
        revert_error(ShortFunding {})
    }
}`;

const PERMIT2_WITNESS = `PermitWitnessTransferFrom(
  TokenPermissions permitted,   // token, limit
  address spender,              // Pacioli
  uint256 nonce,                // authorization nonce
  uint256 deadline,             // openBy
  Authorization witness         // the tab terms
)`;

const RECEIPT = `Receipt(bytes32 tab, uint256 total)

settle(id, total, signature)
  pays the merchant  total - charged   (reverts StaleReceipt if total <= charged)`;

const SETTLE = `let paid = charged.get(key: id)
if total <= paid {
    revert_error(StaleReceipt {})
}
let amount = total - paid
if amount > held.get(key: id) {
    revert_error(ExceedsHeld {})
}`;

const INTEGRATE = `import { hashTypedData } from "viem";
import { authorizationData, erc3009Data, pacioliAbi, receiptData } from "./pacioli";

// Payer: one signature funds the tab (ERC-3009 token such as USDC)
const id = hashTypedData(authorizationData(chainId, pacioli, auth));
const signature = await wallet.signTypedData(erc3009Data(chainId, token, pacioli, auth, id));

// Merchant (or anyone): open it
await wallet.writeContract({ address: pacioli, abi: pacioliAbi,
  functionName: "openWithErc3009", args: [auth, signature] });

// Metered tab: the payer signs running totals, anyone settles
const receipt = await payer.signTypedData(receiptData(chainId, pacioli, id, 12_500000n));
await wallet.writeContract({ address: pacioli, abi: pacioliAbi,
  functionName: "settle", args: [BigInt(id), 12_500000n, receipt] });`;

const code = (text: string) => <code>{text}</code>;

const FACTS = [
  ["1", "signature opens a tab"],
  ["3", "funding sources"],
  ["5", "ledger accounts"],
  ["0", "operator or fee roles"],
] as const;

function useActiveSection() {
  const [active, setActive] = useState<SectionId>("overview");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

export function Docs() {
  const active = useActiveSection();

  return (
    <>
      <Nav current="/docs/" />
      <div className="wrap docs">
        <aside>
          <nav aria-label="Docs">
            <span className="toc-title">On this page</span>
            {SECTIONS.map(([id, label], i) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={active === id ? "true" : undefined}
              >
                <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <article>
          <details className="toc-mobile">
            <summary>On this page</summary>
            <nav aria-label="Docs, mobile">
              {SECTIONS.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </nav>
          </details>

          <section
            id="overview"
            className="dsec hero"
            aria-labelledby="overview-h"
          >
            <span className="tag" data-reveal="up">
              Docs
            </span>
            <h1 id="overview-h" data-reveal="up" style={stagger(80)}>
              Pacioli, <em className="serif">by the book</em>
            </h1>
            <p className="big" data-reveal="up" style={stagger(160)}>
              An auth-capture escrow in Fe. A payer signs one authorization; the
              merchant charges what was used until a deadline; the remainder
              goes back to the payer. Each tab is a small double-entry ledger.
            </p>
            <ul className="facts">
              {FACTS.map(([n, text], i) => (
                <li key={text} data-reveal="up" style={stagger(200 + i * 80)}>
                  <b>{n}</b>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <dl className="slip" data-reveal="up" style={stagger(240)}>
              <div>
                <dt>Network</dt>
                <dd>{chain.name}</dd>
              </div>
              <div>
                <dt>Pacioli</dt>
                <dd>{pacioli}</dd>
              </div>
              <div>
                <dt>Demo Dollar</dt>
                <dd>{token}</dd>
              </div>
              <div>
                <dt>Permit2</dt>
                <dd>{permit2}</dd>
              </div>
            </dl>
          </section>

          <Section
            id="flow"
            n={1}
            title="The flow"
            lede={
              <>
                Four parties, one signed term sheet. The tab opens once, gets
                paid in parts, and ends with the remainder going home.{" "}
                {code("refund")} works any time, up to what was charged.
              </>
            }
          >
            <SequenceDiagram />
          </Section>

          <Section
            id="quickstart"
            n={2}
            title="Quick start"
            lede="The contracts need only Fe. The web demo needs Node 24, pnpm and Foundry's Anvil."
          >
            <div data-reveal="up">
              <Code title="terminal" plain>
                {QUICKSTART}
              </Code>
            </div>
          </Section>

          <Section
            id="authorization"
            n={3}
            title="The authorization"
            lede={
              <>
                The payer signs this EIP-712 struct. The tab id is its digest,
                so one signed authorization opens exactly one tab, and no nonce
                storage is needed.
              </>
            }
          >
            <div data-reveal="up">
              <Code title="EIP-712 · Authorization" marks={[6, 7]}>
                {TYPED_DATA}
              </Code>
            </div>
            <div className="pair">
              <div className="note card" data-reveal="up">
                <span className="tag cobalt">openBy</span>
                <p>
                  The last moment the tab may be opened. After it, every open
                  call reverts with {code("Expired")}.
                </p>
              </div>
              <div className="note card" data-reveal="up" style={stagger(120)}>
                <span className="tag coral">captureBy</span>
                <p>
                  The last moment the merchant may charge or anyone may settle.
                  After it, {code("reclaim")} opens up to anyone.
                </p>
              </div>
            </div>
          </Section>

          <Section
            id="funding"
            n={4}
            title="Funding sources"
            lede={
              <>
                Every source implements the {code("Funding")} trait in{" "}
                {code("src/funding.fe")}. The three open calls share one generic
                path, {code("fund<F: Funding>")}, which also checks that the
                escrow received the full limit (no fee-on-transfer tokens, no
                token without code).
              </>
            }
          >
            <FundingDiagram />
            <Table
              caption="Funding sources compared"
              head={[
                "Call",
                "The payer signs",
                "Approval",
                "Binding to the terms",
              ]}
              rows={[
                [
                  code("open"),
                  "The authorization",
                  "approve(Pacioli, limit)",
                  "Signature over the tab digest; EOA or ERC-1271",
                ],
                [
                  code("openWithErc3009"),
                  "ReceiveWithAuthorization",
                  "None",
                  "The ERC-3009 nonce is the tab id",
                ],
                [
                  code("openWithPermit2"),
                  "PermitWitnessTransferFrom",
                  "approve(Permit2) once",
                  "The authorization is the Permit2 witness",
                ],
              ]}
            />
            <div data-reveal="up">
              <Code
                title="src/funding.fe · src/lib.fe"
                marks={[10, 11, 12, 13]}
              >
                {FUNDING}
              </Code>
            </div>
            <p data-reveal="up">
              The Permit2 path follows the canonical witness format, so a wallet
              shows the tab terms inside the Permit2 request:
            </p>
            <div data-reveal="up">
              <Code title="Permit2 · witness" marks={[6]}>
                {PERMIT2_WITNESS}
              </Code>
            </div>
          </Section>

          <Section
            id="receipts"
            n={5}
            title="Metered receipts"
            lede={
              <>
                When {code("metered")} is true, {code("charge")} reverts with{" "}
                {code("Metered")}. The merchant is paid only against receipts:
                the payer signs a running total, and anyone may submit the
                latest one. Receipts are monotonic, so an old receipt is worth
                nothing and a lost one is replaced by the next.
              </>
            }
          >
            <ReceiptsDiagram />
            <div className="pair code-pair">
              <div data-reveal="up">
                <Code title="EIP-712 · Receipt" plain>
                  {RECEIPT}
                </Code>
              </div>
              <div data-reveal="up" style={stagger(120)}>
                <Code title="src/lib.fe · Settle" marks={[2, 3, 5]}>
                  {SETTLE}
                </Code>
              </div>
            </div>
          </Section>

          <Section
            id="ledger"
            n={6}
            title="The ledger"
            lede="Each tab keeps five numbers. Every call posts to two of them."
          >
            <LedgerDiagram />
            <Table
              caption="Postings per call"
              head={["Call", "Debit", "Credit", "Who"]}
              rows={[
                [code("open*"), "held", "payer", "anyone, before openBy"],
                [
                  code("charge"),
                  "charged",
                  "held",
                  "merchant, unmetered, until captureBy",
                ],
                [
                  code("settle"),
                  "charged",
                  "held",
                  "anyone, metered, until captureBy",
                ],
                [code("close"), "released", "held", "merchant"],
                [
                  code("reclaim"),
                  "released",
                  "held",
                  "anyone, after captureBy",
                ],
                [
                  code("refund"),
                  "refunded",
                  "merchant",
                  "merchant, up to charged",
                ],
              ]}
            />
            <p data-reveal="up">
              Invariants: {code("limit = held + charged + released")} and{" "}
              {code("refunded <= charged")}. The Fe tests check both, with the
              token balances, after every step of seeded random sequences of
              charges, receipts and refunds.
            </p>
          </Section>

          <Section id="calls" n={7} title="Calls and errors">
            <Table
              caption="Errors"
              head={["Error", "When"]}
              rows={[
                [
                  code("Expired"),
                  "Opening after openBy, or charging or settling after captureBy",
                ],
                [code("NotExpired"), "Reclaiming before captureBy"],
                [
                  code("ZeroAmount"),
                  "A zero limit, charge or refund, or closing a tab with nothing held",
                ],
                [code("NoMerchant"), "The merchant is the zero address"],
                [code("AlreadyOpen"), "The authorization already opened a tab"],
                [
                  code("BadSignature"),
                  "The signature does not cover these terms",
                ],
                [
                  code("NotMerchant"),
                  "charge, close or refund from anyone but the merchant",
                ],
                [
                  code("ExceedsHeld"),
                  "A charge or receipt above what the tab holds",
                ],
                [code("ExceedsCharged"), "A refund above what was charged"],
                [
                  code("Metered / NotMetered"),
                  "charge on a metered tab, settle on an unmetered one",
                ],
                [
                  code("StaleReceipt"),
                  "A receipt total not above what was paid",
                ],
                [
                  code("ShortFunding"),
                  "The escrow received less than the limit",
                ],
              ]}
            />
            <p data-reveal="up">
              Views: {code("digest(auth)")}, {code("receiptDigest(id, total)")},{" "}
              {code("terms(id)")}, {code("accounts(id)")} and{" "}
              {code("permit2()")}. Events: {code("Opened")}, {code("Charged")},{" "}
              {code("Released")}, {code("Refunded")}.
            </p>
          </Section>

          <Section
            id="integrate"
            n={8}
            title="Integrate with viem"
            lede={
              <>
                {code("web/src/pacioli.ts")} exports the ABI and the typed data
                for all four signatures.
              </>
            }
          >
            <div data-reveal="up">
              <Code title="viem · open and settle" marks={[5, 6]}>
                {INTEGRATE}
              </Code>
            </div>
          </Section>

          <Section id="security" n={9} title="Security and limits">
            <ul className="limits">
              {[
                <>Not audited. Do not use with real funds.</>,
                <>
                  A signed authorization cannot be cancelled before{" "}
                  {code("openBy")}; keep it short.
                </>,
                <>
                  {code("close")} and {code("reclaim")} push the remainder to
                  the payer; a token that blocks the payer leaves it stuck.
                </>,
                <>
                  Refunds have no deadline, and there is no operator or fee
                  role.
                </>,
                <>
                  On an unmetered tab the merchant can charge up to the limit on
                  its own word; use a metered tab when that matters.
                </>,
              ].map((item, i) => (
                <li key={i} data-reveal="up" style={stagger(i * 70)}>
                  {item}
                </li>
              ))}
            </ul>
            <p data-reveal="up">
              Source: <a href={REPO}>{REPO.replace("https://", "")}</a>
            </p>
          </Section>
        </article>
      </div>
      <Footer />
    </>
  );
}
