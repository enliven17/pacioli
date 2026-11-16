// Deploys Pacioli and DemoToken from ../out (run `fe build` first) and records
// the addresses in src/deployment.json.
//
//   RPC_URL      default http://127.0.0.1:8545
//   PRIVATE_KEY  default Anvil account 0
//
// On Anvil, Permit2 is installed at its canonical address with the bytecode
// deployed on Sepolia, so the Permit2 path runs against the real contract.
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, createWalletClient, encodeAbiParameters, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PERMIT2 } from "../src/pacioli.ts";

const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const transport = http(process.env.RPC_URL ?? "http://127.0.0.1:8545");
const account = privateKeyToAccount((process.env.PRIVATE_KEY ?? ANVIL_KEY) as Hex);
const reader = createPublicClient({ transport });
const wallet = createWalletClient({ transport, account });

async function deploy(name: string, args: Hex = "0x") {
  const code = readFileSync(new URL(`../../out/${name}.bin`, import.meta.url), "utf8").trim();
  const data = `0x${code.replace(/^0x/, "")}${args.slice(2)}` as Hex;
  const hash = await wallet.sendTransaction({ data, chain: null });
  const receipt = await reader.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`${name} failed to deploy`);
  }
  return receipt.contractAddress;
}

const chainId = await reader.getChainId();
if (chainId === 31337 && !(await reader.getCode({ address: PERMIT2 }))) {
  const code = await createPublicClient({ transport: http(SEPOLIA_RPC) }).getCode({ address: PERMIT2 });
  if (!code) throw new Error("could not fetch Permit2 bytecode");
  await reader.request({ method: "anvil_setCode" as never, params: [PERMIT2, code] as never });
}

const pacioli = await deploy("Pacioli", encodeAbiParameters([{ type: "address" }], [PERMIT2]));
const token = await deploy("DemoToken");
const deployment = { chainId, pacioli, token, permit2: PERMIT2 };
writeFileSync(
  new URL("../src/deployment.json", import.meta.url),
  JSON.stringify(deployment, null, 2) + "\n",
);
console.log(deployment);
