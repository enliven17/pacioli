import { useMemo } from "react";
import { hashTypedData, hexToBigInt } from "viem";
import type { Session } from "./App.tsx";
import { authorizationData, decode, openArgs, openFunction, pacioliAbi, type SignedAuthorization } from "../pacioli.ts";
import { chain, clock, money, pacioli, send, short, SYMBOL } from "../wallet.ts";

const SOURCE = { allowance: "Allowance", erc3009: "ERC-3009", permit2: "Permit2" } as const;

function parse(code: string): SignedAuthorization | undefined {
  try {
    return code.trim() ? decode(code) : undefined;
  } catch {
    return undefined;
  }
}

export function Merchant({
  session,
  code,
  onCode,
  onOpened,
}: {
  session: Session;
  code: string;
  onCode: (code: string) => void;
  onOpened: (id: bigint) => void;
}) {
  const { account, busy, run } = session;
  const signed = useMemo(() => parse(code), [code]);
  const id = signed && hexToBigInt(hashTypedData(authorizationData(chain.id, pacioli, signed)));

  const open = () =>
    run("Opening the tab", async () => {
      await send(account!, {
        address: pacioli,
        abi: pacioliAbi,
        functionName: openFunction[signed!.funding],
        args: openArgs(signed!),
      });
      onOpened(id!);
    });

  const link = `${location.origin}${location.pathname}#a=${code.trim()}`;

  return (
    <article className="panel">
      <header>
        <span className="tag">02. Merchant</span>
        <img src="/art/vault.webp" alt="" width="720" height="720" />
      </header>
      <h2>Open the tab.</h2>
      <p className="hint">Paste the signed authorization. The limit moves into escrow.</p>

      <label>
        Authorization
        <textarea
          value={code}
          onChange={(e) => onCode(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="Signed authorization from the payer"
        />
      </label>

      {code.trim() && !signed && <p className="hint bad">This is not a valid authorization.</p>}

      {signed && (
        <>
          <dl className="lines">
            <div>
              <dt>Payer</dt>
              <dd>{short(signed.payer)}</dd>
            </div>
            <div>
              <dt>Merchant</dt>
              <dd>{short(signed.merchant)}</dd>
            </div>
            <div>
              <dt>Limit</dt>
              <dd>
                {money(signed.limit)} {SYMBOL}
              </dd>
            </div>
            <div>
              <dt>Funding</dt>
              <dd>{SOURCE[signed.funding]}</dd>
            </div>
            <div>
              <dt>Metered</dt>
              <dd>{signed.metered ? "Yes, receipts only" : "No"}</dd>
            </div>
            <div>
              <dt>Open by</dt>
              <dd>{clock(signed.openBy)}</dd>
            </div>
            <div>
              <dt>Capture by</dt>
              <dd>{clock(signed.captureBy)}</dd>
            </div>
          </dl>
          <button className="wide" disabled={!account || busy} onClick={open}>
            Open tab
          </button>
          <div className="pair">
            <button className="ghost" onClick={() => navigator.clipboard.writeText(link)}>
              Copy link
            </button>
            <button className="ghost" onClick={() => onOpened(id!)}>
              View tab
            </button>
          </div>
        </>
      )}
    </article>
  );
}
