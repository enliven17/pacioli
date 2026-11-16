import { useEffect, useState } from "react";
import {
  Figure,
  Tabs,
  Traveler,
  arrowHead,
  cx,
  textWidth,
  useDiagram,
  useTween,
} from "./diagram.tsx";

type Account = "held" | "charged" | "released" | "refunded";
type Party = "payer" | "merchant";
type Node = Account | Party;

interface Books {
  held: number;
  charged: number;
  released: number;
  refunded: number;
}

interface Posting {
  call: string;
  debit: Node;
  credit: Node;
  amount: number;
  text: string;
}

const LIMIT = 100;
const EMPTY: Books = { held: 0, charged: 0, released: 0, refunded: 0 };

const SCENARIOS = {
  unmetered: [
    {
      call: "open",
      debit: "held",
      credit: "payer",
      amount: 100,
      text: "Anyone opens before openBy; the escrow pulls the full limit from the payer.",
    },
    {
      call: "charge(id, 30)",
      debit: "charged",
      credit: "held",
      amount: 30,
      text: "The merchant charges 30 and is paid at once.",
    },
    {
      call: "charge(id, 25)",
      debit: "charged",
      credit: "held",
      amount: 25,
      text: "A second partial charge, still before captureBy.",
    },
    {
      call: "refund(id, 10)",
      debit: "refunded",
      credit: "merchant",
      amount: 10,
      text: "The merchant refunds 10 from its own balance; held is not touched.",
    },
    {
      call: "close(id)",
      debit: "released",
      credit: "held",
      amount: 45,
      text: "The merchant closes; the 45 still held goes back to the payer.",
    },
  ],
  metered: [
    {
      call: "open",
      debit: "held",
      credit: "payer",
      amount: 100,
      text: "Anyone opens before openBy; the escrow pulls the full limit from the payer.",
    },
    {
      call: "settle(id, 20, sig)",
      debit: "charged",
      credit: "held",
      amount: 20,
      text: "A receipt for a running total of 20: the merchant gets 20 − 0.",
    },
    {
      call: "settle(id, 65, sig)",
      debit: "charged",
      credit: "held",
      amount: 45,
      text: "The next receipt says 65: the merchant gets 65 − 20 = 45.",
    },
    {
      call: "refund(id, 5)",
      debit: "refunded",
      credit: "merchant",
      amount: 5,
      text: "The merchant refunds 5, never more than it charged.",
    },
    {
      call: "reclaim(id)",
      debit: "released",
      credit: "held",
      amount: 35,
      text: "After captureBy anyone reclaims; the 35 left goes to the payer.",
    },
  ],
} satisfies Record<string, Posting[]>;

type ScenarioKey = keyof typeof SCENARIOS;

const SCENARIO_TABS = [
  ["unmetered", "Unmetered tab"],
  ["metered", "Metered tab"],
] as const;

const ACCOUNTS: Account[] = ["held", "charged", "released", "refunded"];

function booksAfter(postings: Posting[], step: number): Books {
  return postings.slice(0, step).reduce<Books>((books, p) => {
    const next = { ...books };
    if (p.debit !== "payer" && p.debit !== "merchant")
      next[p.debit] += p.amount;
    if (p.credit !== "payer" && p.credit !== "merchant")
      next[p.credit] -= p.amount;
    return next;
  }, EMPTY);
}

function geometry(compact: boolean) {
  const width = compact ? 380 : 780;
  const tankW = compact ? 74 : 124;
  const gap = compact ? 18 : 40;
  const start = compact ? 18 : 92;
  const top = compact ? 170 : 176;
  const bottom = compact ? 318 : 330;
  const x: Record<Node, number> = {
    held: start + tankW / 2,
    charged: start + tankW * 1.5 + gap,
    released: start + tankW * 2.5 + gap * 2,
    refunded: start + tankW * 3.5 + gap * 3,
    payer: compact ? 58 : 120,
    merchant: compact ? 316 : 660,
  };
  const partyY = compact ? 44 : 50;
  return {
    width,
    height: bottom + (compact ? 64 : 70),
    tankW,
    top,
    bottom,
    x,
    partyY,
    font: compact ? 11 : 13,
  };
}

type Geo = ReturnType<typeof geometry>;

/** The arc a posting travels: from the credited node to the debited one. */
function arc(p: Posting, g: Geo) {
  const from = p.credit;
  const to = p.debit;
  const isParty = (n: Node) => n === "payer" || n === "merchant";
  const sx = g.x[from] + (isParty(from) ? 0 : 14);
  const sy = isParty(from) ? g.partyY + 16 : g.top - 4;
  const ex = g.x[to] - (isParty(from) ? 0 : 14);
  const ey = g.top - 6;
  if (isParty(from)) {
    const midY = (sy + ey) / 2;
    return {
      d: `M${sx} ${sy} C${sx} ${midY} ${ex} ${midY} ${ex} ${ey}`,
      end: [ex, ey],
      before: [ex, ey - 10],
    };
  }
  const lift = to === "released" ? 112 : 70;
  const peak = g.top - lift;
  return {
    d: `M${sx} ${sy} C${sx} ${peak} ${ex} ${peak} ${ex} ${ey}`,
    end: [ex, ey],
    before: [ex, ey - 10],
  };
}

function Tank({
  name,
  value,
  g,
  role,
  reduced,
}: {
  name: Account;
  value: number;
  g: Geo;
  role?: "debit" | "credit";
  reduced: boolean;
}) {
  const shown = useTween(value, reduced);
  const x = g.x[name] - g.tankW / 2;
  const h = g.bottom - g.top;
  return (
    <g className={cx("tank", name, role)}>
      <rect
        className="shell"
        x={x}
        y={g.top}
        width={g.tankW}
        height={h}
        rx={10}
      />
      <rect
        className="fill"
        x={x + 4}
        y={g.top + 4}
        width={g.tankW - 8}
        height={h - 8}
        rx={7}
        style={{
          transform: `scaleY(${Math.max(0, Math.min(1, value / LIMIT))})`,
        }}
      />
      <text
        className="name"
        x={g.x[name]}
        y={g.top + 22}
        textAnchor="middle"
        fontSize={g.font}
      >
        {name}
      </text>
      <text
        className="num"
        x={g.x[name]}
        y={g.top + 54}
        textAnchor="middle"
        fontSize={g.font * 1.9}
      >
        {shown}
      </text>
      {role && (
        <text
          className="badge"
          x={g.x[name]}
          y={g.bottom + 22}
          textAnchor="middle"
          fontSize={g.font}
        >
          {role === "debit" ? "Dr" : "Cr"}
        </text>
      )}
    </g>
  );
}

export function LedgerDiagram() {
  const dg = useDiagram(0.35);
  const [scenario, setScenario] = useState<ScenarioKey>("unmetered");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const postings: Posting[] = SCENARIOS[scenario];
  const last = postings.length;
  const books = booksAfter(postings, step);
  const posting = step > 0 ? postings[step - 1] : null;
  const g = geometry(dg.compact);

  // Start playing once, the first time the figure scrolls into view.
  useEffect(() => {
    if (dg.on && !dg.reduced) setPlaying(true);
  }, [dg.on, dg.reduced]);

  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(
      () => setStep((s) => s + 1),
      step === 0 ? 700 : 2100,
    );
    return () => clearTimeout(timer);
  }, [playing, step, last]);

  const choose = (key: ScenarioKey) => {
    setScenario(key);
    setStep(0);
    setPlaying(!dg.reduced);
  };

  const held = useTween(books.held, dg.reduced);
  const charged = useTween(books.charged, dg.reduced);
  const released = useTween(books.released, dg.reduced);
  const refunded = useTween(books.refunded, dg.reduced);
  const path = posting ? arc(posting, g) : null;
  const roleOf = (n: Node) =>
    posting?.debit === n
      ? "debit"
      : posting?.credit === n
        ? "credit"
        : undefined;
  const amountLabel = posting ? String(posting.amount) : "";
  const chipW = textWidth(amountLabel, g.font) + 16;
  const dimY = g.bottom + (dg.compact ? 46 : 50);
  const dimL = g.x.held - g.tankW / 2;
  const dimR = g.x.released + g.tankW / 2;

  return (
    <Figure
      dg={dg}
      label="Fig. 3"
      title={
        <>
          Five numbers, <em className="serif">always balanced</em>
        </>
      }
      caption="Every call posts one debit and one credit. The tanks are filled against the limit; refunded is a memo account outside the escrow."
    >
      <Tabs
        label="Scenario"
        items={SCENARIO_TABS}
        value={scenario}
        onChange={choose}
        idPrefix="ledger"
      />
      <div
        id="ledger-panel"
        role="tabpanel"
        aria-labelledby={`ledger-tab-${scenario}`}
      >
        <svg
          className="dg-svg ledger"
          viewBox={`0 0 ${g.width} ${g.height}`}
          role="img"
          aria-label={`Ledger after step ${step} of ${last}: held ${books.held}, charged ${books.charged}, released ${books.released}, refunded ${books.refunded}, limit ${LIMIT}.`}
        >
          {(["payer", "merchant"] as const).map((party) => {
            const w = dg.compact ? 92 : 116;
            const role = roleOf(party);
            return (
              <g key={party} className={cx("party", role)}>
                <rect
                  x={g.x[party] - w / 2}
                  y={g.partyY - 16}
                  width={w}
                  height={32}
                  rx={16}
                />
                <text
                  x={g.x[party]}
                  y={g.partyY + 4.5}
                  textAnchor="middle"
                  fontSize={g.font}
                >
                  {party}
                  {role ? (role === "debit" ? " · Dr" : " · Cr") : ""}
                </text>
              </g>
            );
          })}

          {ACCOUNTS.map((name) => (
            <Tank
              key={name}
              name={name}
              value={books[name]}
              g={g}
              role={roleOf(name)}
              reduced={dg.reduced}
            />
          ))}

          {/* limit spans the three escrow accounts: a dimension line. */}
          <g className="dim">
            <path
              d={`M${dimL} ${dimY - 8}v16M${dimR} ${dimY - 8}v16M${dimL} ${dimY}H${dimR}`}
            />
            <polygon points={arrowHead(dimL, dimY, dimL + 10, dimY, 8)} />
            <polygon points={arrowHead(dimR, dimY, dimR - 10, dimY, 8)} />
            <rect
              x={(dimL + dimR) / 2 - 58}
              y={dimY - 11}
              width={116}
              height={22}
              rx={4}
            />
            <text
              x={(dimL + dimR) / 2}
              y={dimY + 4.5}
              textAnchor="middle"
              fontSize={g.font}
            >
              limit = {LIMIT}
            </text>
          </g>

          {posting && path && (
            <g key={`${scenario}-${step}`} className="posting">
              <path className="a-dash flow" d={path.d} pathLength={1} />
              <polygon
                className="a-pop flow-head"
                points={arrowHead(
                  path.end[0],
                  path.end[1],
                  path.before[0],
                  path.before[1],
                  10,
                )}
              />
              <Traveler
                d={path.d}
                runKey={`${scenario}-${step}`}
                duration={900}
                wait={150}
                reduced={dg.reduced}
              >
                <rect
                  x={-chipW / 2}
                  y={-12}
                  width={chipW}
                  height={24}
                  rx={12}
                  className="chip"
                />
                <text
                  y={4.5}
                  textAnchor="middle"
                  fontSize={g.font}
                  className="chip-t"
                >
                  {amountLabel}
                </text>
              </Traveler>
            </g>
          )}
        </svg>

        <div className="ledger-read">
          <p className="eq" aria-live="polite">
            <span>
              <b>limit</b> {LIMIT}
            </span>
            <span className="op">=</span>
            <span className={cx(roleOf("held"))}>
              <b>held</b> {held}
            </span>
            <span className="op">+</span>
            <span className={cx(roleOf("charged"))}>
              <b>charged</b> {charged}
            </span>
            <span className="op">+</span>
            <span className={cx(roleOf("released"))}>
              <b>released</b> {released}
            </span>
            <span className="ok">
              {step === 0
                ? "not open yet"
                : held + charged + released === LIMIT
                  ? "✓"
                  : "…"}
            </span>
          </p>
          <p className="eq small">
            <span className={cx(roleOf("refunded"))}>
              <b>refunded</b> {refunded}
            </span>
            <span className="op">≤</span>
            <span>
              <b>charged</b> {charged}
            </span>
            <span className="ok">✓</span>
          </p>
          <p className="now">
            {posting ? (
              <>
                <code>{posting.call}</code> <span>{posting.text}</span>
                <span className="post">
                  Dr {posting.debit} {posting.amount} · Cr {posting.credit}{" "}
                  {posting.amount}
                </span>
              </>
            ) : (
              <span>
                The payer has signed; nothing has moved. Press play or step
                through.
              </span>
            )}
          </p>
        </div>

        <div className="stepper">
          <button
            type="button"
            className="ghost dg-btn"
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.max(0, s - 1));
            }}
            disabled={step === 0}
          >
            Prev
          </button>
          <button
            type="button"
            className="dg-btn lime"
            onClick={() => {
              if (playing) return setPlaying(false);
              if (step >= last) setStep(0);
              setPlaying(true);
            }}
          >
            {playing ? "Pause" : step >= last ? "Replay" : "Play"}
          </button>
          <button
            type="button"
            className="ghost dg-btn"
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.min(last, s + 1));
            }}
            disabled={step >= last}
          >
            Next
          </button>
          <ol className="steps" aria-label="Steps">
            {postings.map((p, i) => (
              <li key={p.call}>
                <button
                  type="button"
                  aria-current={step === i + 1 ? "step" : undefined}
                  className={cx(step > i && "done")}
                  onClick={() => {
                    setPlaying(false);
                    setStep(i + 1);
                  }}
                >
                  {p.call.replace(/\(.*\)/, "")}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Figure>
  );
}
