import { useEffect, useState } from "react";
import { hashTypedData, isAddress, maxUint256, type Address } from "viem";
import type { Session } from "./App.tsx";
import {
  authorizationData,
  encode,
  erc3009Data,
  permit2Data,
  tokenAbi,
  type Authorization,
  type Funding,
} from "../pacioli.ts";
import { amount, chain, money, pacioli, permit2, reader, send, signTypedData, SYMBOL, token, TOKEN } from "../wallet.ts";

const OPEN_WINDOW = 15n * 60n;

const FUNDING: { value: Funding; label: string; note: string }[] = [
  { value: "erc3009", label: "ERC-3009", note: "One signature, no approval." },
  { value: "permit2", label: "Permit2", note: "Approve Permit2 once, then one signature per tab." },
  { value: "allowance", label: "Allowance", note: "Approve the escrow, then sign the tab." },
];

function randomNonce(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytes.reduce((n, b) => (n << 8n) | BigInt(b), 0n);
}

export function Payer({ session, onSigned }: { session: Session; onSigned: (code: string) => void }) {
  const { account, tick, busy, run } = session;
  const [balance, setBalance] = useState<bigint>();
  const [merchant, setMerchant] = useState("");
  const [limit, setLimit] = useState("25");
  const [minutes, setMinutes] = useState("60");
  const [funding, setFunding] = useState<Funding>("erc3009");
  const [metered, setMetered] = useState(true);

  useEffect(() => {
    if (!account) return setBalance(undefined);
    reader
      .readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [account] })
      .then(setBalance, () => setBalance(undefined));
  }, [account, tick]);

  const value = amount(limit);
  const window = /^\d+$/.test(minutes) && Number(minutes) > 0 ? BigInt(minutes) * 60n : undefined;
  const ready = account && isAddress(merchant) && value && window;

  const mint = () =>
    run(`Minting 100 ${SYMBOL}`, () =>
      send(account!, { address: token, abi: tokenAbi, functionName: "mint", args: [account, amount("100")] }),
    );

  /** Approves `spender` when its allowance is below `needed`. */
  const ensureAllowance = async (spender: Address, needed: bigint, approve: bigint) => {
    const current = await reader.readContract({
      address: token,
      abi: tokenAbi,
      functionName: "allowance",
      args: [account!, spender],
    });
    if (current < needed) {
      await send(account!, { address: token, abi: tokenAbi, functionName: "approve", args: [spender, approve] });
    }
  };

  const sign = () =>
    run("Signing the authorization", async () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const auth: Authorization = {
        payer: account!,
        merchant: merchant as Address,
        token,
        limit: value!,
        openBy: now + OPEN_WINDOW,
        captureBy: now + window!,
        metered,
        nonce: randomNonce(),
      };
      const id = hashTypedData(authorizationData(chain.id, pacioli, auth));
      let data: object;
      if (funding === "allowance") {
        await ensureAllowance(pacioli, value!, value!);
        data = authorizationData(chain.id, pacioli, auth);
      } else if (funding === "permit2") {
        await ensureAllowance(permit2, value!, maxUint256);
        data = permit2Data(chain.id, permit2, pacioli, auth);
      } else {
        data = erc3009Data(chain.id, TOKEN, pacioli, auth, id);
      }
      const signature = await signTypedData(account!, data);
      onSigned(encode({ ...auth, funding, signature }));
    });

  return (
    <article className="panel">
      <header>
        <span className="tag">01. Payer</span>
        <img src="/art/sign.webp" alt="" width="720" height="720" />
      </header>
      <h2>Sign once.</h2>
      <p className="hint">Nothing moves until the merchant opens the tab.</p>

      <dl className="lines">
        <div>
          <dt>Balance</dt>
          <dd>{balance === undefined ? "—" : `${money(balance)} ${SYMBOL}`}</dd>
        </div>
      </dl>
      <button className="ghost wide" disabled={!account || busy} onClick={mint}>
        Mint 100 test {SYMBOL}
      </button>

      <label>
        Merchant address
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
        />
      </label>
      <div className="pair">
        <label>
          Limit ({SYMBOL})
          <input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" />
        </label>
        <label>
          Window (min)
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" />
        </label>
      </div>

      <fieldset className="choice">
        <legend>Funding</legend>
        {FUNDING.map((option) => (
          <label key={option.value} className={funding === option.value ? "on" : undefined}>
            <input
              type="radio"
              name="funding"
              value={option.value}
              checked={funding === option.value}
              onChange={() => setFunding(option.value)}
            />
            <b>{option.label}</b>
            <small>{option.note}</small>
          </label>
        ))}
      </fieldset>

      <label className="toggle">
        <input type="checkbox" checked={metered} onChange={(e) => setMetered(e.target.checked)} />
        <span>
          <b>Metered</b> The merchant can only charge totals you sign as receipts.
        </span>
      </label>

      <button className="wide" disabled={!ready || busy} onClick={sign}>
        {funding === "erc3009" ? "Sign" : "Approve and sign"}
      </button>
      {!account && <p className="hint">Connect a wallet to sign.</p>}
    </article>
  );
}
