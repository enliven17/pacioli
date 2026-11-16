import { useState } from "react";
import { Code } from "../ui/Code.tsx";

const FEATURES = [
  {
    key: "effects",
    title: "Effects",
    lede: "A refund cannot touch the escrow.",
    body: "Each handler names the state and capabilities it may use. `held` is not in Refund's list, so writing it is a compile error, not a code review comment.",
    file: "src/lib.fe",
    marks: [2, 4],
    code: `Refund { id, amount }
uses (ctx, mut call, terms, charged, mut refunded, mut log)
{
    // \`held\` is not listed: a refund cannot touch the escrow.
    let done = refunded.get(key: id)
    if amount > charged.get(key: id) - done {
        revert_error(ExceedsCharged {})
    }
    refunded.set(key: id, value: done + amount)
    ...
}`,
    error: `error[8-0116]: contract field \`held\` is not in this handler's \`uses\`
  --> src/lib.fe
   |
   |   held.set(key: id, value: 0)
   |   ^^^^ \`held\` is not reachable here`,
  },
  {
    key: "trait",
    title: "Trait + generics",
    lede: "Three funding sources, one open path.",
    body: "Allowance, ERC-3009 and Permit2 implement one trait whose method declares its own effects. `fund` is generic over it and checks that the full limit arrived.",
    file: "src/funding.fe · src/lib.fe",
    marks: [1, 2, 3, 10, 13],
    code: `pub trait Funding {
    fn collect(self, auth: Authorization, id: u256, escrow: Address)
        uses (ctx: Ctx, call: mut Call)
}

impl Funding for Allowance { ... }
impl Funding for Erc3009 { ... }
impl Funding for Permit2 { ... }

fn fund<F: Funding>(_ source: F, auth: Authorization, id: u256)
    uses (ctx: Ctx, call: mut Call)
{
    let before = balance_of(token: auth.token, account: ctx.address())
    source.collect(auth, id, escrow: ctx.address())
    if balance_of(token: auth.token, account: ctx.address()) - before != auth.limit {
        revert_error(ShortFunding {})
    }
}`,
  },
  {
    key: "abi",
    title: "ABI structs",
    lede: "Permit2's nested tuples, typed.",
    body: "`#[abi]` structs encode as Solidity tuples, so the Permit2 call is checked against its selector at compile time, down to the witness type string.",
    file: "src/funding.fe",
    marks: [1, 4, 8],
    code: `#[abi]
pub struct TokenPermissions { pub token: Address, pub amount: u256 }

#[abi]
pub struct PermitTransferFrom { pub permitted: TokenPermissions, pub nonce: u256, pub deadline: u256 }

pub msg Permit2Msg {
    #[selector = sol("permitWitnessTransferFrom(((address,uint256),uint256,uint256),(address,uint256),address,bytes32,string,bytes)")]
    PermitWitnessTransferFrom {
        permit: PermitTransferFrom,
        details: SignatureTransferDetails,
        owner: Address,
        witness: Bytes32,
        witness_type: Text,
        signature: Bytes,
    },
}`,
  },
  {
    key: "tests",
    title: "Invariant tests",
    lede: "The books checked after every step.",
    body: "Seeded random sequences of charges, refunds and receipts, with the ledger rule and every token balance asserted after each step. A failure replays exactly.",
    file: "src/tests.fe",
    marks: [3, 4, 5, 6],
    code: `fn assert_books(w: World, id: u256) uses (evm: mut Evm) {
    let (limit, held, charged, released, refunded) = accounts(w, id)
    assert!(held + charged + released == limit)
    assert!(refunded <= charged)
    assert!(balance(w, account: w.pacioli) == held)
    assert!(balance(w, account: evm.address()) == charged - refunded)
}

#[test]
fn books_balance_through_random_charges_and_refunds() uses (evm: mut Evm) {
    var rng = KeccakRng::seeded(0xbeef)
    ...
}`,
  },
];

const ticks = (text: string) =>
  text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

export function FeSection() {
  const [active, setActive] = useState(0);
  const feature = FEATURES[active];
  return (
    <div className="fe-panel">
      <div className="fe-tabs" role="tablist" aria-label="Fe features">
        {FEATURES.map((f, i) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={i === active}
            className={i === active ? "fe-tab on" : "fe-tab"}
            onClick={() => setActive(i)}
          >
            <span className="num mono">0{i + 1}</span>
            <span>
              <b>{f.title}</b>
              <small>{f.lede}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="fe-body" role="tabpanel" key={feature.key}>
        <p className="fe-text">{ticks(feature.body)}</p>
        <Code title={feature.file} marks={feature.marks}>
          {feature.code}
        </Code>
        {feature.error && (
          <div className="compiler">
            <span className="tag coral">fe check</span>
            <pre>{feature.error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
