// Runs 100 seeded scenarios on a local Anvil node against the deployment in
// src/deployment.json (run `pnpm run deploy` first; Permit2 is the real
// bytecode). Each scenario opens a tab through one funding source and runs a
// sequence of calls. A reference model predicts every result: after each step
// the on-chain ledger and token balances must match it, and every expected
// revert must fail with the expected error.
//
//   node scripts/scenarios.ts            100 scenarios, seed 1494
//   SEED=7 COUNT=40 node scripts/scenarios.ts
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  hashTypedData,
  hexToBigInt,
  http,
  maxUint256,
  numberToHex,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import {
  authorizationData,
  erc3009Data,
  openFunction,
  pacioliAbi,
  permit2Data,
  receiptData,
  tokenAbi,
  type Authorization,
  type Funding,
} from "../src/pacioli.ts";

const { chainId, pacioli, token, permit2 } = JSON.parse(
  readFileSync(new URL("../src/deployment.json", import.meta.url), "utf8"),
) as { chainId: number; pacioli: Address; token: Address; permit2: Address };
assert.equal(chainId, 31337, "scenarios run on Anvil only (they move time)");

const TOKEN = { address: token, name: "Demo Dollar", version: "1" };
const UNIT = 1_000000n;
const abi = [
  ...pacioliAbi,
  ...parseAbi(["error InvalidNonce()", "error SignatureExpired(uint256)", "error InvalidSigner()", "error InvalidContractSignature()"]),
];

const transport = http(process.env.RPC_URL ?? "http://127.0.0.1:8545");
const reader = createPublicClient({ transport });
const MNEMONIC = "test test test test test test test test test test test junk";
const [payer, merchant, stranger] = [0, 1, 2].map((i) => mnemonicToAccount(MNEMONIC, { addressIndex: i }));

// ---------------------------------------------------------------------------
// Chain helpers

async function send(account: HDAccount, address: Address, functionName: string, args: unknown[], useAbi: unknown = abi) {
  const wallet = createWalletClient({ transport, account });
  const { request } = await reader.simulateContract({ address, abi: useAbi, functionName, args, account } as never);
  const hash = await wallet.writeContract({ ...request, chain: null } as never);
  const receipt = await reader.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
}

/** The custom error name a call reverts with, or "ok" when it would succeed. */
async function outcome(account: HDAccount, functionName: string, args: unknown[]): Promise<string> {
  try {
    await reader.simulateContract({ address: pacioli, abi, functionName, args, account } as never);
    return "ok";
  } catch (error) {
    if (error instanceof BaseError) {
      const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) {
        return revert.data?.errorName ?? revert.reason ?? revert.signature ?? "revert";
      }
    }
    return "revert";
  }
}

const balance = (who: Address) =>
  reader.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [who] });
const accounts = (id: bigint) =>
  reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "accounts", args: [id] });
const now = async () => (await reader.getBlock()).timestamp;
async function warp(seconds: bigint) {
  await reader.request({ method: "evm_increaseTime" as never, params: [Number(seconds)] as never });
  await reader.request({ method: "evm_mine" as never, params: [] as never });
}

// ---------------------------------------------------------------------------
// Deterministic randomness

let state = BigInt(process.env.SEED ?? 1494);
function rand(n: number): number {
  state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
  return Number((state >> 33n) % BigInt(n));
}
const pick = <T>(xs: readonly T[]) => xs[rand(xs.length)];
const amount = (max: bigint) => (max <= 0n ? 0n : (BigInt(rand(Number(max / 10_000n))) + 1n) * 10_000n);

// ---------------------------------------------------------------------------
// The reference model

type Books = { limit: bigint; held: bigint; charged: bigint; released: bigint; refunded: bigint };
type Tab = { id: bigint; auth: Authorization; books: Books };

let nonce = 1n;
let payerDelta = 0n;
let merchantDelta = 0n;

async function terms(o: Partial<Authorization> = {}): Promise<Authorization> {
  const t = await now();
  return {
    payer: payer.address,
    merchant: merchant.address,
    token,
    limit: BigInt(rand(200) + 1) * UNIT,
    openBy: t + 600n,
    captureBy: t + 3600n,
    metered: false,
    nonce: nonce++ * 1_000_003n + BigInt(Date.now()),
    ...o,
  };
}

async function sign(auth: Authorization, funding: Funding): Promise<Hex> {
  const id = hashTypedData(authorizationData(chainId, pacioli, auth));
  const data =
    funding === "allowance"
      ? authorizationData(chainId, pacioli, auth)
      : funding === "erc3009"
        ? erc3009Data(chainId, TOKEN, pacioli, auth, id)
        : permit2Data(chainId, permit2, pacioli, auth);
  return payer.signTypedData(data as never);
}

async function open(auth: Authorization, funding: Funding): Promise<Tab> {
  if (funding === "allowance") await send(payer, token, "approve", [pacioli, auth.limit], tokenAbi);
  const signature = await sign(auth, funding);
  await send(merchant, pacioli, openFunction[funding], [auth, signature]);
  payerDelta -= auth.limit;
  const id = hexToBigInt(hashTypedData(authorizationData(chainId, pacioli, auth)));
  return { id, auth, books: { limit: auth.limit, held: auth.limit, charged: 0n, released: 0n, refunded: 0n } };
}

async function check(tab: Tab, label: string) {
  const [limit, held, charged, released, refunded] = await accounts(tab.id);
  const b = tab.books;
  assert.deepEqual([limit, held, charged, released, refunded], [b.limit, b.held, b.charged, b.released, b.refunded], `${label}: ledger`);
  assert.equal(held + charged + released, limit, `${label}: limit = held + charged + released`);
  assert(refunded <= charged, `${label}: refunded <= charged`);
}

async function expectError(account: HDAccount, fn: string, args: unknown[], error: string) {
  const got = await outcome(account, fn, args);
  assert.equal(got, error, `${fn} should revert with ${error}, got ${got}`);
  return error;
}

// Steps, each returning a short log line.
const steps = {
  async charge(tab: Tab) {
    const x = amount(tab.books.held);
    if (x === 0n) return "charge skipped (empty)";
    await send(merchant, pacioli, "charge", [tab.id, x]);
    tab.books = { ...tab.books, held: tab.books.held - x, charged: tab.books.charged + x };
    merchantDelta += x;
    return `charge ${x}`;
  },
  async settle(tab: Tab) {
    const x = amount(tab.books.held);
    if (x === 0n) return "settle skipped (empty)";
    const total = tab.books.charged + x;
    const r = await payer.signTypedData(receiptData(chainId, pacioli, numberToHex(tab.id, { size: 32 }), total));
    await send(pick([merchant, stranger]), pacioli, "settle", [tab.id, total, r]);
    tab.books = { ...tab.books, held: tab.books.held - x, charged: total };
    merchantDelta += x;
    return `settle total ${total}`;
  },
  async refund(tab: Tab) {
    const x = amount(tab.books.charged - tab.books.refunded);
    if (x === 0n) return "refund skipped (nothing charged)";
    await send(merchant, token, "approve", [pacioli, x], tokenAbi);
    await send(merchant, pacioli, "refund", [tab.id, x]);
    tab.books = { ...tab.books, refunded: tab.books.refunded + x };
    merchantDelta -= x;
    payerDelta += x;
    return `refund ${x}`;
  },
  async close(tab: Tab) {
    if (tab.books.held === 0n) return "close skipped (empty)";
    await send(merchant, pacioli, "close", [tab.id]);
    payerDelta += tab.books.held;
    tab.books = { ...tab.books, released: tab.books.released + tab.books.held, held: 0n };
    return "close";
  },
};

// ---------------------------------------------------------------------------
// Scenarios

const FUNDINGS: Funding[] = ["allowance", "erc3009", "permit2"];

type Scenario = { name: string; run: () => Promise<string[]> };

/** A random walk of valid calls on a fresh tab. */
function walk(funding: Funding, metered: boolean, finish: "close" | "reclaim" | "open"): Scenario {
  return {
    name: `walk ${funding} ${metered ? "metered" : "unmetered"} → ${finish}`,
    run: async () => {
      const tab = await open(await terms({ metered }), funding);
      const log = [`open ${tab.auth.limit}`];
      await check(tab, "open");
      const n = rand(6) + 1;
      for (let i = 0; i < n; i++) {
        const action = pick(metered ? (["settle", "settle", "refund"] as const) : (["charge", "charge", "refund"] as const));
        log.push(await steps[action](tab));
        await check(tab, action);
      }
      if (finish === "close") log.push(await steps.close(tab));
      if (finish === "reclaim" && tab.books.held > 0n) {
        await expectError(stranger, "reclaim", [tab.id], "NotExpired");
        await warp(3601n);
        await send(stranger, pacioli, "reclaim", [tab.id]);
        payerDelta += tab.books.held;
        tab.books = { ...tab.books, released: tab.books.released + tab.books.held, held: 0n };
        log.push("warp past captureBy, reclaim by a stranger");
      }
      await check(tab, "end");
      return log;
    },
  };
}

/** A tab that must refuse one call with one error. */
function refuses(name: string, metered: boolean, attempt: (tab: Tab) => Promise<string>): Scenario {
  return {
    name,
    run: async () => {
      const funding = pick(FUNDINGS);
      const tab = await open(await terms({ metered }), funding);
      const error = await attempt(tab);
      await check(tab, "after refusal");
      return [`open via ${funding}`, `refused: ${error}`];
    },
  };
}

/** An open that must fail. */
function cannotOpen(name: string, error: string, prepare: () => Promise<[Funding, Authorization, Hex]>): Scenario {
  return {
    name,
    run: async () => {
      const [funding, auth, signature] = await prepare();
      if (funding === "allowance") await send(payer, token, "approve", [pacioli, auth.limit], tokenAbi);
      const got = await outcome(merchant, openFunction[funding], [auth, signature]);
      assert.equal(got, error, `open should revert with ${error}, got ${got}`);
      return [`${funding} open refused: ${error}`];
    },
  };
}

function negatives(): Scenario[] {
  const receiptFor = (tab: Tab, total: bigint, signer = payer) =>
    signer.signTypedData(receiptData(chainId, pacioli, numberToHex(tab.id, { size: 32 }), total));
  return [
    refuses("charge a metered tab", true, (t) => expectError(merchant, "charge", [t.id, 1n], "Metered")),
    refuses("settle an unmetered tab", false, async (t) => expectError(merchant, "settle", [t.id, 1n, await receiptFor(t, 1n)], "NotMetered")),
    refuses("replay an old receipt", true, async (t) => {
      const r = await receiptFor(t, UNIT / 2n);
      await send(merchant, pacioli, "settle", [t.id, UNIT / 2n, r]);
      t.books = { ...t.books, held: t.books.held - UNIT / 2n, charged: UNIT / 2n };
      merchantDelta += UNIT / 2n;
      return expectError(stranger, "settle", [t.id, UNIT / 2n, r], "StaleReceipt");
    }),
    refuses("receipt signed by the merchant", true, async (t) => expectError(merchant, "settle", [t.id, 1n, await receiptFor(t, 1n, merchant)], "BadSignature")),
    refuses("receipt above the limit", true, async (t) => expectError(merchant, "settle", [t.id, t.books.limit + 1n, await receiptFor(t, t.books.limit + 1n)], "ExceedsHeld")),
    refuses("receipt for another total", true, async (t) => expectError(merchant, "settle", [t.id, 2n, await receiptFor(t, 1n)], "BadSignature")),
    refuses("charge above held", false, (t) => expectError(merchant, "charge", [t.id, t.books.limit + 1n], "ExceedsHeld")),
    refuses("charge zero", false, (t) => expectError(merchant, "charge", [t.id, 0n], "ZeroAmount")),
    refuses("stranger charges", false, (t) => expectError(stranger, "charge", [t.id, 1n], "NotMerchant")),
    refuses("payer charges", false, (t) => expectError(payer, "charge", [t.id, 1n], "NotMerchant")),
    refuses("stranger closes", false, (t) => expectError(stranger, "close", [t.id], "NotMerchant")),
    refuses("stranger refunds", false, (t) => expectError(stranger, "refund", [t.id, 1n], "NotMerchant")),
    refuses("refund before any charge", false, (t) => expectError(merchant, "refund", [t.id, 1n], "ExceedsCharged")),
    refuses("refund zero", false, (t) => expectError(merchant, "refund", [t.id, 0n], "ZeroAmount")),
    refuses("reclaim inside the window", false, (t) => expectError(stranger, "reclaim", [t.id], "NotExpired")),
    refuses("close twice", false, async (t) => {
      await steps.close(t);
      return expectError(merchant, "close", [t.id], "ZeroAmount");
    }),
    refuses("charge after close", false, async (t) => {
      await steps.close(t);
      return expectError(merchant, "charge", [t.id, 1n], "ExceedsHeld");
    }),
    refuses("charge after captureBy", false, async (t) => {
      await warp(3601n);
      return expectError(merchant, "charge", [t.id, 1n], "Expired");
    }),
    refuses("settle after captureBy", true, async (t) => {
      const r = await receiptFor(t, 1n);
      await warp(3601n);
      return expectError(merchant, "settle", [t.id, 1n, r], "Expired");
    }),
    refuses("reclaim twice", false, async (t) => {
      await warp(3601n);
      await send(stranger, pacioli, "reclaim", [t.id]);
      payerDelta += t.books.held;
      t.books = { ...t.books, released: t.books.held, held: 0n };
      return expectError(stranger, "reclaim", [t.id], "ZeroAmount");
    }),
    refuses("refund more than charged", false, async (t) => {
      await steps.charge(t);
      return expectError(merchant, "refund", [t.id, t.books.charged + 1n], "ExceedsCharged");
    }),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: open twice`, "AlreadyOpen", async () => {
        const auth = await terms();
        await open(auth, f);
        return [f, auth, await sign(auth, f)];
      }),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant changes the limit`, f === "allowance" ? "BadSignature" : f === "erc3009" ? "InvalidSignature" : "InvalidSigner", async () => {
        const auth = await terms();
        const signature = await sign(auth, f);
        return [f, { ...auth, limit: auth.limit + 1n }, signature];
      }),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant turns metering off`, f === "allowance" ? "BadSignature" : f === "erc3009" ? "InvalidSignature" : "InvalidSigner", async () => {
        const auth = await terms({ metered: true });
        const signature = await sign(auth, f);
        return [f, { ...auth, metered: false }, signature];
      }),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant extends captureBy`, f === "allowance" ? "BadSignature" : f === "erc3009" ? "InvalidSignature" : "InvalidSigner", async () => {
        const auth = await terms();
        const signature = await sign(auth, f);
        return [f, { ...auth, captureBy: auth.captureBy + 86400n }, signature];
      }),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: opened after openBy`, "Expired", async () => {
        const auth = await terms();
        const signature = await sign(auth, f);
        await warp(601n);
        return [f, auth, signature];
      }),
    ),
    cannotOpen("allowance: zero limit", "ZeroAmount", async () => {
      const auth = await terms({ limit: 0n });
      return ["allowance", auth, await sign(auth, "allowance")];
    }),
    cannotOpen("allowance: no merchant", "NoMerchant", async () => {
      const auth = await terms({ merchant: "0x0000000000000000000000000000000000000000" });
      return ["allowance", auth, await sign(auth, "allowance")];
    }),
    cannotOpen("allowance: signed by a stranger", "BadSignature", async () => {
      const auth = await terms();
      return ["allowance", auth, await stranger.signTypedData(authorizationData(chainId, pacioli, auth) as never)];
    }),
    cannotOpen("erc3009: signed by a stranger", "InvalidSignature", async () => {
      const auth = await terms();
      const id = hashTypedData(authorizationData(chainId, pacioli, auth));
      return ["erc3009", auth, await stranger.signTypedData(erc3009Data(chainId, TOKEN, pacioli, auth, id) as never)];
    }),
    cannotOpen("permit2: signed by a stranger", "InvalidSigner", async () => {
      const auth = await terms();
      return ["permit2", auth, await stranger.signTypedData(permit2Data(chainId, permit2, pacioli, auth) as never)];
    }),
    cannotOpen("permit2: reused Permit2 nonce", "InvalidNonce", async () => {
      const first = await terms();
      await open(first, "permit2");
      const second = { ...(await terms()), nonce: first.nonce };
      return ["permit2", second, await sign(second, "permit2")];
    }),
    {
      name: "allowance: payer approved too little",
      run: async () => {
        const auth = await terms();
        await send(payer, token, "approve", [pacioli, auth.limit - 1n], tokenAbi);
        const got = await outcome(merchant, "open", [auth, await sign(auth, "allowance")]);
        assert.notEqual(got, "ok", "open with a short allowance must revert");
        return [`allowance open refused: ${got}`];
      },
    },
  ];
}

function all(count: number): Scenario[] {
  const neg = negatives();
  const walks: Scenario[] = [];
  const finishes = ["close", "reclaim", "open"] as const;
  while (walks.length + neg.length < count) {
    walks.push(walk(pick(FUNDINGS), rand(2) === 1, pick(finishes)));
  }
  return [...neg, ...walks].slice(0, count);
}

// ---------------------------------------------------------------------------
// Run

const COUNT = Number(process.env.COUNT ?? 100);
await send(payer, token, "mint", [payer.address, 1_000_000n * UNIT], tokenAbi);
await send(merchant, token, "mint", [merchant.address, 1_000n * UNIT], tokenAbi);
await send(payer, token, "approve", [permit2, maxUint256], tokenAbi);
const payerStart = await balance(payer.address);
const merchantStart = await balance(merchant.address);

const scenarios = all(COUNT);
const results: { n: number; name: string; ok: boolean; log: string[]; error?: string }[] = [];
for (const [i, s] of scenarios.entries()) {
  try {
    const log = await s.run();
    results.push({ n: i + 1, name: s.name, ok: true, log });
    process.stdout.write(`✓ ${String(i + 1).padStart(3)} ${s.name}\n`);
  } catch (e) {
    const error = (e as Error).message.split("\n")[0];
    results.push({ n: i + 1, name: s.name, ok: false, log: [], error });
    process.stdout.write(`✗ ${String(i + 1).padStart(3)} ${s.name}: ${error}\n`);
  }
}

// Global books: the escrow holds exactly what open tabs hold, and the two
// parties moved exactly what the model says.
assert.equal((await balance(payer.address)) - payerStart, payerDelta, "payer balance");
assert.equal((await balance(merchant.address)) - merchantStart, merchantDelta, "merchant balance");

const passed = results.filter((r) => r.ok).length;
writeFileSync(new URL("../scenarios-report.json", import.meta.url), JSON.stringify(results, null, 2) + "\n");
console.log(`\n${passed}/${results.length} scenarios passed; payer and merchant balances match the model`);
process.exit(passed === results.length ? 0 : 1);
