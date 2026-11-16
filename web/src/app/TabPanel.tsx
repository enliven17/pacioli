import { useEffect, useState } from "react";
import { numberToHex, type Address, type Hex } from "viem";
import type { Session } from "./App.tsx";
import { decodeReceipt, encodeReceipt, pacioliAbi, receiptData, tokenAbi } from "../pacioli.ts";
import { amount, chain, clock, money, pacioli, reader, send, short, signTypedData, SYMBOL, token } from "../wallet.ts";

type Tab = {
  payer: Address;
  merchant: Address;
  captureBy: bigint;
  metered: boolean;
  limit: bigint;
  held: bigint;
  charged: bigint;
  released: bigint;
  refunded: bigint;
};

async function load(id: bigint): Promise<Tab | undefined> {
  const [terms, accounts] = await Promise.all([
    reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "terms", args: [id] }),
    reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "accounts", args: [id] }),
  ]);
  const [payer, merchant, , captureBy, metered] = terms;
  if (/^0x0+$/.test(payer)) return undefined;
  const [limit, held, charged, released, refunded] = accounts;
  return { payer, merchant, captureBy, metered, limit, held, charged, released, refunded };
}

export function TabPanel({
  session,
  id,
  onId,
}: {
  session: Session;
  id?: bigint;
  onId: (id: bigint) => void;
}) {
  const { account, tick, busy, run } = session;
  const [tab, setTab] = useState<Tab>();
  const [lookup, setLookup] = useState("");
  const [value, setValue] = useState("5");
  const [receipt, setReceipt] = useState("");

  useEffect(() => {
    if (id === undefined) return setTab(undefined);
    load(id).then(setTab, () => setTab(undefined));
  }, [id, tick]);

  const call = (label: string, functionName: string, args: unknown[]) =>
    run(label, () => send(account!, { address: pacioli, abi: pacioliAbi, functionName, args }));

  const isMerchant = tab && account?.toLowerCase() === tab.merchant.toLowerCase();
  const isPayer = tab && account?.toLowerCase() === tab.payer.toLowerCase();
  const expired = tab && BigInt(Math.floor(Date.now() / 1000)) > tab.captureBy;
  const entered = amount(value);

  const signReceipt = () =>
    run("Signing a receipt", async () => {
      const total = tab!.charged + entered!;
      const tabHex = numberToHex(id!, { size: 32 }) as Hex;
      const signature = await signTypedData(account!, receiptData(chain.id, pacioli, tabHex, total));
      setReceipt(encodeReceipt({ tab: tabHex, total, signature }));
    });

  const settle = () => {
    const r = decodeReceipt(receipt);
    return call(`Settling a receipt for ${money(r.total)}`, "settle", [id, r.total, r.signature]);
  };

  const refund = () =>
    run(`Refunding ${value}`, async () => {
      await send(account!, { address: token, abi: tokenAbi, functionName: "approve", args: [pacioli, entered] });
      await send(account!, { address: pacioli, abi: pacioliAbi, functionName: "refund", args: [id, entered] });
    });

  const rows: [string, bigint][] = tab
    ? [
        ["Held", tab.held],
        ["Charged", tab.charged],
        ["Released", tab.released],
      ]
    : [];

  return (
    <article className="panel ledger-panel">
      <header>
        <span className="tag">03. Ledger</span>
        <img src="/art/balance.webp" alt="" width="720" height="720" />
      </header>
      <h2>Charge and settle.</h2>

      {id === undefined ? (
        <>
          <p className="hint">Open a tab, or look one up by id.</p>
          <label>
            Tab id
            <input value={lookup} onChange={(e) => setLookup(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
          </label>
          <button
            className="ghost wide"
            disabled={!/^0x[0-9a-fA-F]{1,64}$/.test(lookup)}
            onClick={() => onId(BigInt(lookup))}
          >
            Look up
          </button>
        </>
      ) : !tab ? (
        <p className="hint">No tab with this id yet.</p>
      ) : (
        <>
          <p className="hint mono">
            {`0x${id.toString(16).slice(0, 10)}…`} · {tab.metered ? "metered" : "unmetered"} · until {clock(tab.captureBy)}
          </p>
          <div className="books">
            {rows.map(([name, v]) => (
              <div key={name}>
                <span>{name}</span>
                <b>{money(v)}</b>
                <i style={{ width: `${tab.limit ? Number((v * 100n) / tab.limit) : 0}%` }} />
              </div>
            ))}
            <div className="total">
              <span>Limit</span>
              <b>
                {money(tab.limit)} {SYMBOL}
              </b>
            </div>
            <div className="side">
              <span>Refunded</span>
              <b>{money(tab.refunded)}</b>
            </div>
          </div>
          <dl className="lines">
            <div>
              <dt>Payer</dt>
              <dd>{short(tab.payer)}</dd>
            </div>
            <div>
              <dt>Merchant</dt>
              <dd>{short(tab.merchant)}</dd>
            </div>
          </dl>

          <label>
            Amount ({SYMBOL})
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
          </label>

          {tab.metered ? (
            <>
              <button className="wide" disabled={!isPayer || !entered || busy || tab.held === 0n} onClick={signReceipt}>
                Payer: sign a receipt for +{value}
              </button>
              <label>
                Receipt
                <textarea
                  value={receipt}
                  onChange={(e) => setReceipt(e.target.value)}
                  rows={2}
                  spellCheck={false}
                  placeholder="Signed receipt from the payer"
                />
              </label>
              <button className="wide" disabled={!account || !receipt.trim() || busy} onClick={settle}>
                Settle receipt
              </button>
            </>
          ) : (
            <button
              className="wide"
              disabled={!isMerchant || !entered || busy || tab.held === 0n}
              onClick={() => call(`Charging ${value}`, "charge", [id, entered])}
            >
              Charge {value}
            </button>
          )}

          <div className="pair">
            <button className="ghost" disabled={!isMerchant || !entered || busy} onClick={refund}>
              Refund
            </button>
            {expired ? (
              <button className="ghost" disabled={!account || busy || tab.held === 0n} onClick={() => call("Reclaiming", "reclaim", [id])}>
                Reclaim
              </button>
            ) : (
              <button className="lime" disabled={!isMerchant || busy || tab.held === 0n} onClick={() => call("Closing the tab", "close", [id])}>
                Close
              </button>
            )}
          </div>
          {!isMerchant && !isPayer && <p className="hint">Connect as the payer or the merchant to act.</p>}
        </>
      )}
    </article>
  );
}
