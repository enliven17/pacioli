// Runs every flow against the deployment in src/deployment.json on a local
// Anvil node. Run `pnpm run deploy` first.
//
//   1. allowance  + unmetered: open, charge twice, close, refund
//   2. ERC-3009   + metered:   one signature opens, receipts settle, close
//   3. Permit2    + unmetered: real Permit2 bytecode, charge, time passes, reclaim
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  hashTypedData,
  hexToBigInt,
  http,
  maxUint256,
  numberToHex,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import {
  authorizationData,
  decode,
  encode,
  erc3009Data,
  openArgs,
  openFunction,
  pacioliAbi,
  permit2Data,
  receiptData,
  tokenAbi,
  type Authorization,
  type Funding,
} from "../src/pacioli.ts";

const deployment = JSON.parse(
  readFileSync(new URL("../src/deployment.json", import.meta.url), "utf8"),
) as { chainId: number; pacioli: Address; token: Address; permit2: Address };
const { chainId, pacioli, token, permit2 } = deployment;
const TOKEN = { address: token, name: "Demo Dollar", version: "1" };

const transport = http(process.env.RPC_URL ?? "http://127.0.0.1:8545");
const reader = createPublicClient({ transport });
// Anvil accounts 0 and 1.
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk";
const payer = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });
const merchant = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 1 });

async function send(account: HDAccount, request: object) {
  const wallet = createWalletClient({ transport, account });
  const { request: checked } = await reader.simulateContract({ ...request, account } as never);
  const hash = await wallet.writeContract({ ...checked, chain: null } as never);
  const receipt = await reader.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
}

const balance = (who: Address) =>
  reader.readContract({ address: token, abi: tokenAbi, functionName: "balanceOf", args: [who] });
const accounts = (id: bigint) =>
  reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "accounts", args: [id] });
const call = (functionName: string, args: unknown[]) =>
  send(merchant, { address: pacioli, abi: pacioliAbi, functionName, args });

/** The double-entry rule after every flow. */
async function books(id: bigint) {
  const [limit, held, charged, released, refunded] = await accounts(id);
  assert.equal(held + charged + released, limit);
  assert(refunded <= charged);
}

async function terms(metered: boolean): Promise<Authorization> {
  const now = (await reader.getBlock()).timestamp;
  return {
    payer: payer.address,
    merchant: merchant.address,
    token,
    limit: 100_000000n,
    openBy: now + 600n,
    captureBy: now + 3600n,
    metered,
    nonce: now * 10n + BigInt(Math.floor(Math.random() * 10)),
  };
}

/** The payer signs for `funding`; the merchant opens the tab from the string. */
async function open(auth: Authorization, funding: Funding) {
  const id = hashTypedData(authorizationData(chainId, pacioli, auth));
  assert.equal(
    await reader.readContract({ address: pacioli, abi: pacioliAbi, functionName: "digest", args: [auth] }),
    hexToBigInt(id),
  );
  const data =
    funding === "allowance"
      ? authorizationData(chainId, pacioli, auth)
      : funding === "erc3009"
        ? erc3009Data(chainId, TOKEN, pacioli, auth, id)
        : permit2Data(chainId, permit2, pacioli, auth);
  const signature = await payer.signTypedData(data as never);
  const received = decode(encode({ ...auth, funding, signature }));
  await call(openFunction[received.funding], openArgs(received) as never);
  assert.equal((await accounts(hexToBigInt(id)))[1], auth.limit);
  return hexToBigInt(id);
}

const mint = (amount: bigint) =>
  send(payer, { address: token, abi: tokenAbi, functionName: "mint", args: [payer.address, amount] });
const approve = (account: HDAccount, spender: Address, amount: bigint) =>
  send(account, { address: token, abi: tokenAbi, functionName: "approve", args: [spender, amount] });

const payerBefore = await balance(payer.address);
const merchantBefore = await balance(merchant.address);
await mint(300_000000n);

// 1. Allowance, unmetered.
await approve(payer, pacioli, 100_000000n);
const first = await open(await terms(false), "allowance");
await call("charge", [first, 30_000000n]);
await call("charge", [first, 12_500000n]);
await call("close", [first]);
await approve(merchant, pacioli, 2_500000n);
await call("refund", [first, 2_500000n]);
assert.deepEqual(await accounts(first), [100_000000n, 0n, 42_500000n, 57_500000n, 2_500000n]);
await books(first);

// A second open with the same authorization must fail.
await assert.rejects(call("open", [await terms(false), "0x"]), /BadSignature|AlreadyOpen/);

// 2. ERC-3009, metered: no approval, one signature to open, one per receipt.
const second = await open(await terms(true), "erc3009");
for (const total of [10_000000n, 25_000000n]) {
  const tab = numberToHex(second, { size: 32 }) as Hex;
  const signature = await payer.signTypedData(receiptData(chainId, pacioli, tab, total));
  await call("settle", [second, total, signature]);
}
await assert.rejects(call("charge", [second, 1n]), /Metered/);
await call("close", [second]);
assert.deepEqual(await accounts(second), [100_000000n, 0n, 25_000000n, 75_000000n, 0n]);
await books(second);

// 3. Permit2 (the real contract), unmetered: the payer approves Permit2 once.
await approve(payer, permit2, maxUint256);
const third = await open(await terms(false), "permit2");
await call("charge", [third, 5_000000n]);
await assert.rejects(call("reclaim", [third]), /NotExpired/);
await reader.request({ method: "evm_increaseTime" as never, params: [3601] as never });
await reader.request({ method: "evm_mine" as never, params: [] as never });
await send(payer, { address: pacioli, abi: pacioliAbi, functionName: "reclaim", args: [third] });
assert.deepEqual(await accounts(third), [100_000000n, 0n, 5_000000n, 95_000000n, 0n]);
await books(third);

assert.equal(await balance(pacioli), 0n);
assert.equal((await balance(payer.address)) - payerBefore, 300_000000n - 42_500000n + 2_500000n - 25_000000n - 5_000000n);
assert.equal((await balance(merchant.address)) - merchantBefore, 42_500000n - 2_500000n + 25_000000n + 5_000000n);
console.log("ok: allowance, erc3009 + receipts, permit2 + reclaim; books balance");
