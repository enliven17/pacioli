// Runs seeded scenarios against the deployment in src/deployment.json, on
// Anvil or on a live network. Each scenario opens a tab through one funding
// source and runs a sequence of calls. A reference model predicts every
// result: after each step the on-chain ledger and token balances must match
// it, and every expected revert must fail with the expected error.
//
// Scenarios run in parallel on WORKERS independent sets of accounts (payer,
// merchant, stranger), funded from PRIVATE_KEY. On a live network deadlines
// are minutes away and the script waits for them; on Anvil it moves time.
//
//   node scripts/scenarios.ts                         Anvil, 100 scenarios
//   node --env-file=.env scripts/scenarios.ts         RPC_URL / PRIVATE_KEY network
//   COUNT=300 WORKERS=10 SEED=7 node ...
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  BaseError,
  concat,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  formatEther,
  hashTypedData,
  hexToBigInt,
  http,
  keccak256,
  maxUint256,
  numberToHex,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
  type PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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

const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const transport = http(process.env.RPC_URL ?? "http://127.0.0.1:8545", { retryCount: 6, timeout: 60_000 });
const reader = createPublicClient({ transport });
assert.equal(await reader.getChainId(), chainId, "RPC_URL is not the deployed network");
const live = chainId !== 31337;

const COUNT = Number(process.env.COUNT ?? 100);
// Anvil moves time for the whole chain, so it runs one worker.
const WORKERS = live ? Number(process.env.WORKERS ?? 10) : 1;
const SEED = BigInt(process.env.SEED ?? 1494);
const TOKEN = { address: token, name: "Demo Dollar", version: "1" };
const UNIT = 1_000000n;
// Live deadlines are close so the waits stay short; walks are shorter to fit.
const OPEN_WINDOW = live ? 240n : 600n;
const CAPTURE_WINDOW = live ? 540n : 3600n;
const MAX_STEPS = live ? 4 : 6;
const GAS = 1_500_000n;

const abi = [
  ...pacioliAbi,
  ...parseAbi(["error InvalidNonce()", "error SignatureExpired(uint256)", "error InvalidSigner()", "error InvalidContractSignature()"]),
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FUNDINGS: Funding[] = ["allowance", "erc3009", "permit2"];

// ---------------------------------------------------------------------------
// Accounts: one funder, and per worker a payer, a merchant and a stranger.

const funder = privateKeyToAccount((process.env.PRIVATE_KEY ?? ANVIL_KEY) as Hex);
const derive = (i: number) => privateKeyToAccount(keccak256(concat([(process.env.PRIVATE_KEY ?? ANVIL_KEY) as Hex, numberToHex(i, { size: 32 })])));

/** Sends transactions from one account with a local nonce, so a lagging RPC never hands out a stale one. */
class Signer {
  nonce = -1;
  account: PrivateKeyAccount;
  wallet;
  constructor(account: PrivateKeyAccount) {
    this.account = account;
    this.wallet = createWalletClient({ transport, account });
  }
  get address() {
    return this.account.address;
  }
  async next() {
    if (this.nonce < 0) this.nonce = await reader.getTransactionCount({ address: this.address, blockTag: "pending" });
    return this.nonce++;
  }
}

// ---------------------------------------------------------------------------
// One worker: its own accounts, model, randomness and log.

type Books = { limit: bigint; held: bigint; charged: bigint; released: bigint; refunded: bigint };
type Tab = { id: bigint; auth: Authorization; books: Books };
type Scenario = { name: string; run: () => Promise<string[]> };

function worker(index: number) {
  const payer = new Signer(derive(index * 3 + 1));
  const merchant = new Signer(derive(index * 3 + 2));
  const stranger = new Signer(derive(index * 3 + 3));
  let state = SEED * 1_000_003n + BigInt(index);
  let nonce = BigInt(Date.now()) * 1000n + BigInt(index);
  let payerDelta = 0n;
  let merchantDelta = 0n;
  /** Every read is pinned to the block of this worker's latest write, so a lagging node cannot show older state. */
  let block = 0n;

  const rand = (n: number) => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number((state >> 33n) % BigInt(n));
  };
  const pick = <T>(xs: readonly T[]) => xs[rand(xs.length)];
  const amount = (max: bigint) => (max <= 0n ? 0n : (BigInt(rand(Number(max / 10_000n))) + 1n) * 10_000n);

  async function atLeast<T>(read: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await read();
      } catch (e) {
        if (i >= 8) throw e;
        await sleep(1500);
      }
    }
  }

  async function send(from: Signer, address: Address, functionName: string, args: unknown[], useAbi: unknown = abi) {
    const nonceUsed = await from.next();
    const hash = await from.wallet.writeContract({
      address,
      abi: useAbi,
      functionName,
      args,
      gas: GAS,
      nonce: nonceUsed,
      chain: null,
    } as never);
    const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 180_000 });
    assert.equal(receipt.status, "success", `${functionName} reverted on chain (${hash})`);
    if (receipt.blockNumber > block) block = receipt.blockNumber;
    return hash;
  }

  async function transferEth(from: Signer, to: Address, value: bigint) {
    const hash = await from.wallet.sendTransaction({ to, value, nonce: await from.next(), chain: null } as never);
    await reader.waitForTransactionReceipt({ hash, timeout: 180_000 });
  }

  /** The custom error a call reverts with at the pinned block, or "ok". */
  async function outcome(from: Signer, functionName: string, args: unknown[]): Promise<string> {
    return atLeast(async () => {
      try {
        await reader.simulateContract({ address: pacioli, abi, functionName, args, account: from.address, blockNumber: block } as never);
        return "ok";
      } catch (error) {
        if (error instanceof BaseError) {
          const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
          if (revert instanceof ContractFunctionRevertedError) {
            return revert.data?.errorName ?? revert.reason ?? "revert";
          }
        }
        throw error;
      }
    });
  }

  const balance = (who: Address) =>
    atLeast(() => reader.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [who], blockNumber: block }));
  const accounts = (id: bigint) =>
    atLeast(() => reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "accounts", args: [id], blockNumber: block }));
  /** Chain time now: new terms start from the latest block, whatever block reads are pinned to. */
  const now = async () => (await atLeast(() => reader.getBlock({ blockTag: "latest" }))).timestamp;

  /** Waits (or warps on Anvil) until the chain is past `ts`, and pins reads to that block. */
  async function until(ts: bigint) {
    if (!live) {
      if ((await reader.getBlock()).timestamp > ts) return;
      await reader.request({ method: "evm_setNextBlockTimestamp" as never, params: [Number(ts + 1n)] as never });
      await reader.request({ method: "evm_mine" as never, params: [] as never });
      // getBlockNumber is cached by viem; read the block itself.
      block = (await reader.getBlock({ blockTag: "latest" })).number;
      return;
    }
    for (;;) {
      const latest = await atLeast(() => reader.getBlock());
      if (latest.timestamp > ts) {
        if (latest.number > block) block = latest.number;
        return;
      }
      await sleep(6000);
    }
  }

  async function terms(o: Partial<Authorization> = {}): Promise<Authorization> {
    const t = await now();
    return {
      payer: payer.address,
      merchant: merchant.address,
      token,
      limit: BigInt(rand(200) + 1) * UNIT,
      openBy: t + OPEN_WINDOW,
      captureBy: t + CAPTURE_WINDOW,
      metered: false,
      nonce: nonce++,
      ...o,
    };
  }

  const idOf = (auth: Authorization) => hashTypedData(authorizationData(chainId, pacioli, auth));

  async function sign(auth: Authorization, funding: Funding, by: Signer = payer): Promise<Hex> {
    const data =
      funding === "allowance"
        ? authorizationData(chainId, pacioli, auth)
        : funding === "erc3009"
          ? erc3009Data(chainId, TOKEN, pacioli, auth, idOf(auth))
          : permit2Data(chainId, permit2, pacioli, auth);
    return by.account.signTypedData(data as never);
  }

  async function open(auth: Authorization, funding: Funding): Promise<Tab> {
    if (funding === "allowance") await send(payer, token, "approve", [pacioli, auth.limit], tokenAbi);
    await send(merchant, pacioli, openFunction[funding], [auth, await sign(auth, funding)]);
    payerDelta -= auth.limit;
    return {
      id: hexToBigInt(idOf(auth)),
      auth,
      books: { limit: auth.limit, held: auth.limit, charged: 0n, released: 0n, refunded: 0n },
    };
  }

  async function check(tab: Tab, label: string) {
    const [limit, held, charged, released, refunded] = await accounts(tab.id);
    const b = tab.books;
    assert.deepEqual([limit, held, charged, released, refunded], [b.limit, b.held, b.charged, b.released, b.refunded], `${label}: ledger`);
    assert.equal(held + charged + released, limit, `${label}: limit = held + charged + released`);
    assert(refunded <= charged, `${label}: refunded <= charged`);
  }

  async function expectError(from: Signer, fn: string, args: unknown[], error: string) {
    const got = await outcome(from, fn, args);
    assert.equal(got, error, `${fn} should revert with ${error}, got ${got}`);
    return error;
  }

  const receiptFor = (tab: Tab, total: bigint, signer: Signer = payer) =>
    signer.account.signTypedData(receiptData(chainId, pacioli, numberToHex(tab.id, { size: 32 }), total));

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
      await send(pick([merchant, stranger]), pacioli, "settle", [tab.id, total, await receiptFor(tab, total)]);
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
    async reclaim(tab: Tab) {
      if (tab.books.held === 0n) return "reclaim skipped (empty)";
      await expectError(stranger, "reclaim", [tab.id], "NotExpired");
      await until(tab.auth.captureBy);
      await send(stranger, pacioli, "reclaim", [tab.id]);
      payerDelta += tab.books.held;
      tab.books = { ...tab.books, released: tab.books.released + tab.books.held, held: 0n };
      return "past captureBy, reclaim by a stranger";
    },
  };

  /** A random walk of valid calls on a fresh tab. */
  function walk(funding: Funding, metered: boolean, finish: "close" | "reclaim" | "open"): Scenario {
    return {
      name: `walk ${funding} ${metered ? "metered" : "unmetered"} → ${finish}`,
      run: async () => {
        const tab = await open(await terms({ metered }), funding);
        const log = [`open ${tab.auth.limit}`];
        await check(tab, "open");
        const n = rand(MAX_STEPS) + 1;
        for (let i = 0; i < n; i++) {
          const action = pick(metered ? (["settle", "settle", "refund"] as const) : (["charge", "charge", "refund"] as const));
          log.push(await steps[action](tab));
          await check(tab, action);
        }
        if (finish !== "open") log.push(await steps[finish](tab));
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

  /** An open that must fail with `error`. */
  function cannotOpen(name: string, error: string, prepare: () => Promise<[Funding, Authorization, Hex]>): Scenario {
    return {
      name,
      run: async () => {
        const [funding, auth, signature] = await prepare();
        if (funding === "allowance") await send(payer, token, "approve", [pacioli, auth.limit], tokenAbi);
        await expectError(merchant, openFunction[funding], [auth, signature], error);
        return [`${funding} open refused: ${error}`];
      },
    };
  }

  const editedTerms = (f: Funding, edit: (a: Authorization) => Authorization, o: Partial<Authorization> = {}) => async () => {
    const auth = await terms(o);
    return [f, edit(auth), await sign(auth, f)] as [Funding, Authorization, Hex];
  };
  const rejectedBy = (f: Funding) => (f === "allowance" ? "BadSignature" : f === "erc3009" ? "InvalidSignature" : "InvalidSigner");

  const negatives: Scenario[] = [
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
      await until(t.auth.captureBy);
      return expectError(merchant, "charge", [t.id, 1n], "Expired");
    }),
    refuses("settle after captureBy", true, async (t) => {
      const r = await receiptFor(t, 1n);
      await until(t.auth.captureBy);
      return expectError(merchant, "settle", [t.id, 1n, r], "Expired");
    }),
    refuses("reclaim twice", false, async (t) => {
      await steps.reclaim(t);
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
    ...FUNDINGS.map((f) => cannotOpen(`${f}: merchant changes the limit`, rejectedBy(f), editedTerms(f, (a) => ({ ...a, limit: a.limit + 1n })))),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant turns metering off`, rejectedBy(f), editedTerms(f, (a) => ({ ...a, metered: false }), { metered: true })),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant extends captureBy`, rejectedBy(f), editedTerms(f, (a) => ({ ...a, captureBy: a.captureBy + 86400n }))),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: merchant names itself payee`, f === "allowance" ? "BadSignature" : rejectedBy(f), editedTerms(f, (a) => ({ ...a, merchant: stranger.address }))),
    ),
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: opened after openBy`, "Expired", async () => {
        const auth = await terms();
        const signature = await sign(auth, f);
        await until(auth.openBy);
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
    ...FUNDINGS.map((f) =>
      cannotOpen(`${f}: signed by a stranger`, rejectedBy(f), async () => {
        const auth = await terms();
        return [f, auth, await sign(auth, f, stranger)];
      }),
    ),
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

  const finishes = ["close", "reclaim", "open"] as const;
  const scenario = (g: number): Scenario => negatives[g] ?? walk(pick(FUNDINGS), rand(2) === 1, pick(finishes));

  return {
    index,
    signers: [payer, merchant, stranger],
    negatives: negatives.length,
    scenario,
    async setup() {
      await send(payer, token, "mint", [payer.address, 1_000_000n * UNIT], tokenAbi);
      await send(merchant, token, "mint", [merchant.address, 10_000n * UNIT], tokenAbi);
      await send(payer, token, "approve", [permit2, maxUint256], tokenAbi);
      return [await balance(payer.address), await balance(merchant.address)] as const;
    },
    async books(start: readonly [bigint, bigint]) {
      assert.equal((await balance(payer.address)) - start[0], payerDelta, `worker ${index}: payer balance`);
      assert.equal((await balance(merchant.address)) - start[1], merchantDelta, `worker ${index}: merchant balance`);
    },
    transferEth,
  };
}

// ---------------------------------------------------------------------------
// Run

const workers = Array.from({ length: WORKERS }, (_, i) => worker(i));
const total = Math.max(COUNT, workers[0].negatives);
const fundEach = live ? parseEther("0.02") : parseEther("1");

const bank = new Signer(funder);
const started = Date.now();
const funderBefore = await reader.getBalance({ address: funder.address });
console.log(`${live ? "live" : "anvil"} chain ${chainId}: ${total} scenarios on ${WORKERS} workers, seed ${SEED}`);
for (const w of workers) {
  for (const s of w.signers) {
    const have = await reader.getBalance({ address: s.address });
    if (have < fundEach / 2n) await workers[0].transferEth(bank, s.address, fundEach - have);
  }
}

type Result = { n: number; worker: number; name: string; ok: boolean; log: string[]; error?: string; seconds: number };
const results: Result[] = [];
let done = 0;

await Promise.all(
  workers.map(async (w) => {
    const start = await w.setup();
    for (let g = w.index; g < total; g += WORKERS) {
      const s = w.scenario(g);
      const t = Date.now();
      try {
        const log = await s.run();
        results.push({ n: g + 1, worker: w.index, name: s.name, ok: true, log, seconds: (Date.now() - t) / 1000 });
      } catch (e) {
        const error = (e as Error).message.split("\n")[0];
        results.push({ n: g + 1, worker: w.index, name: s.name, ok: false, log: [], error, seconds: (Date.now() - t) / 1000 });
      }
      const r = results.at(-1)!;
      done++;
      console.log(`${r.ok ? "✓" : "✗"} ${String(r.n).padStart(3)} [w${w.index}] ${r.name}${r.ok ? "" : `: ${r.error}`}  (${done}/${total})`);
    }
    await w.books(start);
  }),
);

results.sort((a, b) => a.n - b.n);
const passed = results.filter((r) => r.ok).length;
const spent = funderBefore - (await reader.getBalance({ address: funder.address }));
const report = {
  chainId,
  seed: Number(SEED),
  workers: WORKERS,
  scenarios: results.length,
  passed,
  minutes: Math.round((Date.now() - started) / 600) / 100,
  funderSpentEth: formatEther(spent),
  results,
};
writeFileSync(new URL(`../scenarios-report${live ? `-${chainId}` : ""}.json`, import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(`\n${passed}/${results.length} scenarios passed in ${report.minutes} min; every worker's balances match the model`);
console.log(`funder spent ${formatEther(spent)} ETH (worker funding plus gas)`);
process.exit(passed === results.length ? 0 : 1);
