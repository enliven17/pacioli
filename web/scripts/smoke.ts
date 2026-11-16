// One-account check of a live deployment: the PRIVATE_KEY account signs as the
// payer and acts as the merchant. Opens a metered tab for 100 with one
// ERC-3009 signature, settles a receipt for 42.5 and closes it.
//
//   RPC_URL, PRIVATE_KEY   as for deploy.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, hashTypedData, hexToBigInt, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { authorizationData, erc3009Data, pacioliAbi, receiptData, tokenAbi, type Authorization } from "../src/pacioli.ts";

const { chainId, pacioli, token } = JSON.parse(
  readFileSync(new URL("../src/deployment.json", import.meta.url), "utf8"),
) as { chainId: number; pacioli: Address; token: Address };

const transport = http(process.env.RPC_URL);
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
const reader = createPublicClient({ transport });
const wallet = createWalletClient({ transport, account });

async function send(request: object) {
  const { request: checked } = await reader.simulateContract({ ...request, account } as never);
  const hash = await wallet.writeContract({ ...checked, chain: null } as never);
  const receipt = await reader.waitForTransactionReceipt({ hash, confirmations: 2 });
  assert.equal(receipt.status, "success");
  return hash;
}

assert.equal(await reader.getChainId(), chainId, "RPC_URL is not the deployed network");
const now = (await reader.getBlock()).timestamp;
const auth: Authorization = {
  payer: account.address,
  merchant: account.address,
  token,
  limit: 100_000000n,
  openBy: now + 900n,
  captureBy: now + 3600n,
  metered: true,
  nonce: now,
};

await send({ address: token, abi: tokenAbi, functionName: "mint", args: [account.address, auth.limit] });

const tab = hashTypedData(authorizationData(chainId, pacioli, auth));
const id = hexToBigInt(tab);
const funding = await account.signTypedData(
  erc3009Data(chainId, { address: token, name: "Demo Dollar", version: "1" }, pacioli, auth, tab),
);
const opened = await send({ address: pacioli, abi: pacioliAbi, functionName: "openWithErc3009", args: [auth, funding] });

const receipt = await account.signTypedData(receiptData(chainId, pacioli, tab, 42_500000n));
await send({ address: pacioli, abi: pacioliAbi, functionName: "settle", args: [id, 42_500000n, receipt] });
await send({ address: pacioli, abi: pacioliAbi, functionName: "close", args: [id] });

const [limit, held, charged, released] = await reader.readContract({
  address: pacioli,
  abi: pacioliAbi,
  functionName: "accounts",
  args: [id],
});
assert.deepEqual([limit, held, charged, released], [100_000000n, 0n, 42_500000n, 57_500000n]);
console.log(`ok: tab ${tab} opened in ${opened}, settled 42.5, closed`);
