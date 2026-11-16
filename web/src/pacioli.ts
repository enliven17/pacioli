import { parseAbi, type Address, type Hex } from "viem";

const AUTH = "(address payer, address merchant, address token, uint256 limit, uint256 openBy, uint256 captureBy, bool metered, uint256 nonce) auth";

export const pacioliAbi = parseAbi([
  `function open(${AUTH}, bytes signature) returns (uint256)`,
  `function openWithErc3009(${AUTH}, bytes signature) returns (uint256)`,
  `function openWithPermit2(${AUTH}, bytes signature) returns (uint256)`,
  "function charge(uint256 id, uint256 amount)",
  "function settle(uint256 id, uint256 total, bytes signature)",
  "function close(uint256 id)",
  "function reclaim(uint256 id)",
  "function refund(uint256 id, uint256 amount)",
  `function digest(${AUTH}) view returns (uint256)`,
  "function receiptDigest(uint256 id, uint256 total) view returns (uint256)",
  "function terms(uint256 id) view returns (address payer, address merchant, address token, uint256 captureBy, bool metered)",
  "function accounts(uint256 id) view returns (uint256 limit, uint256 held, uint256 charged, uint256 released, uint256 refunded)",
  "function permit2() view returns (address)",
  "event Opened(uint256 indexed id, address indexed payer, address indexed merchant, address token, uint256 limit, uint256 captureBy, bool metered)",
  "event Charged(uint256 indexed id, uint256 amount)",
  "event Released(uint256 indexed id, uint256 amount)",
  "event Refunded(uint256 indexed id, uint256 amount)",
  "error Expired()",
  "error NotExpired()",
  "error ZeroAmount()",
  "error NoMerchant()",
  "error AlreadyOpen()",
  "error BadSignature()",
  "error NotMerchant()",
  "error ExceedsHeld()",
  "error ExceedsCharged()",
  "error Metered()",
  "error NotMetered()",
  "error StaleReceipt()",
  "error ShortFunding()",
]);

export const tokenAbi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "error AuthorizationNotValid()",
  "error AuthorizationUsed()",
  "error InvalidSignature()",
]);

/** Canonical Permit2, the same address on every chain. */
export const PERMIT2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

/** How the limit reaches the escrow. */
export type Funding = "allowance" | "erc3009" | "permit2";

export type Authorization = {
  payer: Address;
  merchant: Address;
  token: Address;
  limit: bigint;
  openBy: bigint;
  captureBy: bigint;
  metered: boolean;
  nonce: bigint;
};

export type SignedAuthorization = Authorization & { funding: Funding; signature: Hex };

const authorizationType = [
  { name: "payer", type: "address" },
  { name: "merchant", type: "address" },
  { name: "token", type: "address" },
  { name: "limit", type: "uint256" },
  { name: "openBy", type: "uint256" },
  { name: "captureBy", type: "uint256" },
  { name: "metered", type: "bool" },
  { name: "nonce", type: "uint256" },
] as const;

const domain = (chainId: number, pacioli: Address) =>
  ({ name: "Pacioli", version: "1", chainId, verifyingContract: pacioli }) as const;

/** The authorization itself; the payer signs this for `open`. */
export function authorizationData(chainId: number, pacioli: Address, message: Authorization) {
  return {
    domain: domain(chainId, pacioli),
    types: { Authorization: authorizationType },
    primaryType: "Authorization",
    message,
  } as const;
}

/** A receipt for a running total on a metered tab. */
export function receiptData(chainId: number, pacioli: Address, tab: Hex, total: bigint) {
  return {
    domain: domain(chainId, pacioli),
    types: {
      Receipt: [
        { name: "tab", type: "bytes32" },
        { name: "total", type: "uint256" },
      ],
    },
    primaryType: "Receipt",
    message: { tab, total },
  } as const;
}

/** ERC-3009 `ReceiveWithAuthorization` whose nonce is the tab id. */
export function erc3009Data(
  chainId: number,
  token: { address: Address; name: string; version: string },
  pacioli: Address,
  a: Authorization,
  id: Hex,
) {
  return {
    domain: { name: token.name, version: token.version, chainId, verifyingContract: token.address },
    types: {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "ReceiveWithAuthorization",
    message: { from: a.payer, to: pacioli, value: a.limit, validAfter: 0n, validBefore: a.openBy, nonce: id },
  } as const;
}

/** Permit2 `PermitWitnessTransferFrom` with the authorization as witness. */
export function permit2Data(chainId: number, permit2: Address, pacioli: Address, a: Authorization) {
  return {
    domain: { name: "Permit2", chainId, verifyingContract: permit2 },
    types: {
      PermitWitnessTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "witness", type: "Authorization" },
      ],
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
      Authorization: authorizationType,
    },
    primaryType: "PermitWitnessTransferFrom",
    message: {
      permitted: { token: a.token, amount: a.limit },
      spender: pacioli,
      nonce: a.nonce,
      deadline: a.openBy,
      witness: a,
    },
  } as const;
}

export const openFunction = {
  allowance: "open",
  erc3009: "openWithErc3009",
  permit2: "openWithPermit2",
} as const satisfies Record<Funding, string>;

export function openArgs(a: SignedAuthorization) {
  const { funding: _, signature, ...auth } = a;
  return [auth, signature] as const;
}

/** A signed authorization as a URL-safe string the payer hands to the merchant. */
export function encode(a: SignedAuthorization): string {
  const json = JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  return btoa(json).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decode(text: string): SignedAuthorization {
  const raw = JSON.parse(atob(text.trim().replaceAll("-", "+").replaceAll("_", "/")));
  return {
    payer: raw.payer,
    merchant: raw.merchant,
    token: raw.token,
    limit: BigInt(raw.limit),
    openBy: BigInt(raw.openBy),
    captureBy: BigInt(raw.captureBy),
    metered: Boolean(raw.metered),
    nonce: BigInt(raw.nonce),
    funding: raw.funding ?? "allowance",
    signature: raw.signature,
  };
}

/** A signed receipt as a URL-safe string. */
export function encodeReceipt(r: { tab: Hex; total: bigint; signature: Hex }): string {
  return btoa(JSON.stringify({ ...r, total: r.total.toString() }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function decodeReceipt(text: string): { tab: Hex; total: bigint; signature: Hex } {
  const raw = JSON.parse(atob(text.trim().replaceAll("-", "+").replaceAll("_", "/")));
  return { tab: raw.tab, total: BigInt(raw.total), signature: raw.signature };
}
