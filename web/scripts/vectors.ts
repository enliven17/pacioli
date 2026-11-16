// Prints the typed-data vectors that src/tests.fe checks, computed with viem
// from the definitions in src/pacioli.ts, independent of the Fe code.
//   node scripts/vectors.ts
import { hashStruct, hashTypedData, parseSignature } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PERMIT2, authorizationData, permit2Data, receiptData, type Authorization } from "../src/pacioli.ts";

// Anvil account 0.
const account = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const pacioli = "0xdddddddddddddddddddddddddddddddddddddddd";
const chainId = 31337;

const auth: Authorization = {
  payer: account.address,
  merchant: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  token: "0xcccccccccccccccccccccccccccccccccccccccc",
  limit: 100n,
  openBy: 2000000000n,
  captureBy: 2000003600n,
  metered: true,
  nonce: 1n,
};

const data = authorizationData(chainId, pacioli, auth);
const digest = hashTypedData(data);
const sig = parseSignature(await account.signTypedData(data));

console.log(`const VECTOR_STRUCT_HASH: u256 = ${hashStruct({ data: auth, types: data.types, primaryType: "Authorization" })}`);
console.log(`const VECTOR_DIGEST: u256 = ${digest}`);
console.log(`const VECTOR_SIG_R: u256 = ${sig.r}`);
console.log(`const VECTOR_SIG_S: u256 = ${sig.s}`);
console.log(`const VECTOR_SIG_V: u8 = ${Number(sig.v)}`);
console.log(`const VECTOR_RECEIPT_DIGEST: u256 = ${hashTypedData(receiptData(chainId, pacioli, digest, 42n))}`);
console.log(`const VECTOR_PERMIT2_DIGEST: u256 = ${hashTypedData(permit2Data(chainId, PERMIT2, pacioli, auth))}`);
