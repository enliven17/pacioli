import { useEffect, useState, type ReactNode } from "react";
import { Footer, Nav, REPO } from "../ui/Shell.tsx";
import { chain, pacioli, permit2, token } from "../wallet.ts";

const SECTIONS = [
  ["overview", "Overview"],
  ["quickstart", "Quick start"],
  ["authorization", "The authorization"],
  ["funding", "Funding sources"],
  ["receipts", "Metered receipts"],
  ["ledger", "The ledger"],
  ["calls", "Calls and errors"],
  ["integrate", "Integrate with viem"],
  ["security", "Security and limits"],
] as const;

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="snippet blueprint">
      <button className="ghost copy" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

const RECEIPT = `Receipt(bytes32 tab, uint256 total)

settle(id, total, signature)
  pays the merchant  total - charged   (reverts StaleReceipt if total <= charged)`;

const PERMIT2_WITNESS = `PermitWitnessTransferFrom(
  TokenPermissions permitted,   // token, limit
  address spender,              // Pacioli
  uint256 nonce,                // authorization nonce
  uint256 deadline,             // openBy
  Authorization witness         // the tab terms
)`;

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

export function Docs() {
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Nav current="/docs/" />
      <div className="wrap docs">
        <aside>
          <nav aria-label="Docs">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}>
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <article>
          <section id="overview">
            <span className="tag">Docs</span>
            <h1>Pacioli</h1>
            <p className="big">
              An auth-capture escrow in Fe. A payer signs one authorization; the merchant charges
              what was used until a deadline; the remainder goes back to the payer. Each tab is a
              small double-entry ledger.
            </p>
            <dl className="slip">
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

          <section id="quickstart">
            <h2>Quick start</h2>
            <p>The contracts need only Fe. The web demo needs Node 24, pnpm and Foundry's Anvil.</p>
            <Code>{QUICKSTART}</Code>
          </section>

          <section id="authorization">
            <h2>The authorization</h2>
            <p>
              The payer signs this EIP-712 struct. The tab id is its digest, so one signed
              authorization opens exactly one tab, and no nonce storage is needed. {code("openBy")}{" "}
              bounds when the tab may be opened, {code("captureBy")} when it may be charged.
            </p>
            <Code>{TYPED_DATA}</Code>
          </section>

          <section id="funding">
            <h2>Funding sources</h2>
            <p>
              Every source implements the {code("Funding")} trait in {code("src/funding.fe")}. The
              three open calls share one generic path, {code("fund<F: Funding>")}, which also checks
              that the escrow received the full limit (no fee-on-transfer tokens, no token without
              code).
            </p>
            <Table
              head={["Call", "The payer signs", "Approval", "Binding to the terms"]}
              rows={[
                [code("open"), "The authorization", "approve(Pacioli, limit)", "Signature over the tab digest; EOA or ERC-1271"],
                [code("openWithErc3009"), "ReceiveWithAuthorization", "None", "The ERC-3009 nonce is the tab id"],
                [code("openWithPermit2"), "PermitWitnessTransferFrom", "approve(Permit2) once", "The authorization is the Permit2 witness"],
              ]}
            />
            <p>
              The Permit2 path follows the canonical witness format, so a wallet shows the tab terms
              inside the Permit2 request:
            </p>
            <Code>{PERMIT2_WITNESS}</Code>
          </section>

          <section id="receipts">
            <h2>Metered receipts</h2>
            <p>
              When {code("metered")} is true, {code("charge")} reverts with {code("Metered")}. The
              merchant is paid only against receipts: the payer signs a running total, and anyone may
              submit the latest one. Receipts are monotonic, so an old receipt is worth nothing and a
              lost one is replaced by the next.
            </p>
            <Code>{RECEIPT}</Code>
          </section>

          <section id="ledger">
            <h2>The ledger</h2>
            <p>Each tab keeps five numbers. Every call posts to two of them.</p>
            <Table
              head={["Call", "Debit", "Credit", "Who"]}
              rows={[
                [code("open*"), "held", "payer", "anyone, before openBy"],
                [code("charge"), "charged", "held", "merchant, unmetered, until captureBy"],
                [code("settle"), "charged", "held", "anyone, metered, until captureBy"],
                [code("close"), "released", "held", "merchant"],
                [code("reclaim"), "released", "held", "anyone, after captureBy"],
                [code("refund"), "refunded", "merchant", "merchant, up to charged"],
              ]}
            />
            <p>
              Invariants: {code("limit = held + charged + released")} and{" "}
              {code("refunded <= charged")}. The Fe tests check both, with the token balances, after
              every step of seeded random sequences of charges, receipts and refunds.
            </p>
          </section>

          <section id="calls">
            <h2>Calls and errors</h2>
            <Table
              head={["Error", "When"]}
              rows={[
                [code("Expired"), "Opening after openBy, or charging after captureBy"],
                [code("NotExpired"), "Reclaiming before captureBy"],
                [code("AlreadyOpen"), "The authorization already opened a tab"],
                [code("BadSignature"), "The signature does not cover these terms"],
                [code("NotMerchant"), "charge, close or refund from anyone but the merchant"],
                [code("ExceedsHeld"), "A charge or receipt above what the tab holds"],
                [code("ExceedsCharged"), "A refund above what was charged"],
                [code("Metered / NotMetered"), "charge on a metered tab, settle on an unmetered one"],
                [code("StaleReceipt"), "A receipt total not above what was paid"],
                [code("ShortFunding"), "The escrow received less than the limit"],
              ]}
            />
            <p>
              Views: {code("digest(auth)")}, {code("receiptDigest(id, total)")}, {code("terms(id)")},{" "}
              {code("accounts(id)")} and {code("permit2()")}. Events: {code("Opened")},{" "}
              {code("Charged")}, {code("Released")}, {code("Refunded")}.
            </p>
          </section>

          <section id="integrate">
            <h2>Integrate with viem</h2>
            <p>
              {code("web/src/pacioli.ts")} exports the ABI and the typed data for all four signatures.
            </p>
            <Code>{INTEGRATE}</Code>
          </section>

          <section id="security">
            <h2>Security and limits</h2>
            <ul>
              <li>Not audited. Do not use with real funds.</li>
              <li>A signed authorization cannot be cancelled before {code("openBy")}; keep it short.</li>
              <li>
                {code("close")} and {code("reclaim")} push the remainder to the payer; a token that
                blocks the payer leaves it stuck.
              </li>
              <li>Refunds have no deadline, and there is no operator or fee role.</li>
              <li>
                On an unmetered tab the merchant can charge up to the limit on its own word; use a
                metered tab when that matters.
              </li>
            </ul>
            <p>
              Source: <a href={REPO}>{REPO.replace("https://", "")}</a>
            </p>
          </section>
        </article>
      </div>
      <Footer />
    </>
  );
}
