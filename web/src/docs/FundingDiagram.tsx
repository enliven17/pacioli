import { useState } from "react";
import {
  Figure,
  ReplayButton,
  Tabs,
  arrowHead,
  cx,
  delay,
  useDiagram,
} from "./diagram.tsx";

type LaneKey = "allowance" | "erc3009" | "permit2";

interface Lane {
  call: string;
  signs: string;
  signsNote: string;
  approval: string;
  /** The contract that actually moves the tokens. */
  mover: string;
  moverCall: string;
  moverExtra?: string;
  /** Who checks the payer's signature. */
  verifier: "mover" | "escrow";
  binding: string;
}

const LANES: Record<LaneKey, Lane> = {
  allowance: {
    call: "open(auth, sig)",
    signs: "Authorization",
    signsNote: "the tab digest · EOA or ERC-1271",
    approval: "approve(Pacioli, limit)",
    mover: "dUSD token",
    moverCall: "transferFrom(payer, Pacioli)",
    verifier: "escrow",
    binding: "Pacioli checks the signature over the tab digest itself.",
  },
  erc3009: {
    call: "openWithErc3009(auth, sig)",
    signs: "ReceiveWithAuthorization",
    signsNote: "nonce = tab id",
    approval: "no approval",
    mover: "dUSD token",
    moverCall: "receiveWithAuthorization",
    verifier: "mover",
    binding:
      "The token checks the signature; its nonce is the tab id, so it fits these terms only.",
  },
  permit2: {
    call: "openWithPermit2(auth, sig)",
    signs: "PermitWitnessTransferFrom",
    signsNote: "witness = Authorization",
    approval: "approve(Permit2) once",
    mover: "Permit2",
    moverCall: "permitWitnessTransferFrom",
    moverExtra: "→ dUSD.transferFrom",
    verifier: "mover",
    binding:
      "Permit2 checks the signature and spends the nonce; the terms ride along as the witness.",
  },
};

const TABS = [
  ["allowance", "Allowance"],
  ["erc3009", "ERC-3009"],
  ["permit2", "Permit2"],
] as const;

interface Geometry {
  width: number;
  height: number;
  font: number;
  payer: { x: number; y: number; r: number };
  approval: { x: number; y: number };
  card: { x: number; y: number; w: number; h: number };
  mover: { x: number; y: number; w: number; h: number };
  escrow: { x: number; y: number; w: number; h: number };
  track: string;
  call: {
    d: string;
    end: [number, number];
    from: [number, number];
    lx: number;
    ly: number;
    anchor: "middle" | "end";
  };
  verify: { mover: string; escrow: string; lx: number; ly: number };
  check: { x: number; y: number };
}

const WIDE: Geometry = {
  width: 780,
  height: 360,
  font: 12.5,
  payer: { x: 98, y: 180, r: 40 },
  approval: { x: 98, y: 116 },
  card: { x: 18, y: 262, w: 236, h: 62 },
  mover: { x: 380, y: 180, w: 236, h: 92 },
  escrow: { x: 672, y: 180, w: 150, h: 124 },
  track: "M138 180 L597 180",
  call: {
    d: "M672 118 C672 56 380 56 380 130",
    end: [380, 134],
    from: [380, 110],
    lx: 526,
    ly: 54,
    anchor: "middle",
  },
  verify: {
    mover: "M254 300 C336 300 380 280 380 230",
    escrow: "M254 306 C460 330 672 320 672 246",
    lx: 268,
    ly: 346,
  },
  check: { x: 672, y: 270 },
};

const NARROW: Geometry = {
  width: 380,
  height: 540,
  font: 11,
  payer: { x: 300, y: 76, r: 34 },
  approval: { x: 300, y: 134 },
  card: { x: 10, y: 44, w: 200, h: 62 },
  mover: { x: 190, y: 262, w: 248, h: 92 },
  escrow: { x: 190, y: 436, w: 190, h: 96 },
  track: "M300 150 C300 196 190 176 190 222 L190 388",
  call: {
    d: "M285 436 C352 436 352 262 318 262",
    end: [316, 262],
    from: [330, 262],
    lx: 364,
    ly: 352,
    anchor: "end",
  },
  verify: {
    mover: "M60 106 C24 150 24 262 64 262",
    escrow: "M60 106 C14 190 14 436 94 436",
    lx: 14,
    ly: 186,
  },
  check: { x: 190, y: 504 },
};

function Coins({ track, reduced }: { track: string; reduced: boolean }) {
  if (reduced) return null;
  return (
    <g className="coins" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={0}>
          <circle r={10} />
          <text y={4} textAnchor="middle" fontSize={11}>
            $
          </text>
          <animateMotion
            dur="2.7s"
            begin={`${i * 0.9}s`}
            repeatCount="indefinite"
            path={track}
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.08;0.88;1"
            dur="2.7s"
            begin={`${i * 0.9}s`}
            repeatCount="indefinite"
          />
        </g>
      ))}
    </g>
  );
}

export function FundingDiagram() {
  const dg = useDiagram(0.3);
  const [key, setKey] = useState<LaneKey>("erc3009");
  const lane = LANES[key];
  const g = dg.compact ? NARROW : WIDE;
  const f = g.font;
  const box = (b: { x: number; y: number; w: number; h: number }) => ({
    x: b.x - b.w / 2,
    y: b.y - b.h / 2,
    width: b.w,
    height: b.h,
  });

  return (
    <Figure
      dg={dg}
      label="Fig. 2"
      title={
        <>
          Three ways in, <em className="serif">one escrow</em>
        </>
      }
      actions={<ReplayButton onClick={dg.replay} />}
      caption="Whichever source pays, the tab opens through the same generic fund<F: Funding>, which compares the escrow balance before and after."
    >
      <Tabs
        label="Funding source"
        items={TABS}
        value={key}
        onChange={setKey}
        idPrefix="funding"
      />
      <div
        id="funding-panel"
        role="tabpanel"
        aria-labelledby={`funding-tab-${key}`}
      >
        <svg
          className="dg-svg fund"
          viewBox={`0 0 ${g.width} ${g.height}`}
          role="img"
          aria-label={`${lane.call}: the payer signs ${lane.signs} (${lane.signsNote}), ${lane.approval}. Pacioli calls ${lane.mover} ${lane.moverCall}, which moves the limit from the payer into the escrow.`}
        >
          <g key={`${key}-${dg.run}`} className="fund-play">
            <path className="track" d={g.track} />
            {dg.on && <Coins track={g.track} reduced={dg.reduced} />}

            {/* Signature: who signs what, and who checks it. */}
            <path
              className="a-dash verify"
              d={lane.verifier === "mover" ? g.verify.mover : g.verify.escrow}
              pathLength={1}
              style={delay(0.5)}
            />
            <text
              className="a-fade note"
              x={g.verify.lx}
              y={g.verify.ly}
              fontSize={f - 1}
              style={delay(0.9)}
              transform={
                dg.compact
                  ? `rotate(-90 ${g.verify.lx} ${g.verify.ly})`
                  : undefined
              }
              textAnchor={dg.compact ? "middle" : "start"}
            >
              {lane.verifier === "mover"
                ? `${lane.mover} verifies`
                : "Pacioli verifies"}
            </text>
            <g className="a-fade card" style={delay(0.1)}>
              <rect
                x={g.card.x}
                y={g.card.y}
                width={g.card.w}
                height={g.card.h}
                rx={10}
              />
              <text
                className="k"
                x={g.card.x + 12}
                y={g.card.y + 19}
                fontSize={f - 1.5}
              >
                PAYER SIGNS
              </text>
              <text
                className="v"
                x={g.card.x + 12}
                y={g.card.y + 37}
                fontSize={f}
              >
                {lane.signs}
              </text>
              <text
                className="k"
                x={g.card.x + 12}
                y={g.card.y + 53}
                fontSize={f - 1.5}
              >
                {lane.signsNote}
              </text>
            </g>

            <g className="payer">
              <circle cx={g.payer.x} cy={g.payer.y} r={g.payer.r} />
              <text
                x={g.payer.x}
                y={g.payer.y + 5}
                textAnchor="middle"
                fontSize={f + 1.5}
              >
                Payer
              </text>
            </g>
            <g
              className={cx("a-fade chip", key === "erc3009" && "none")}
              style={delay(0.25)}
            >
              <text
                x={g.approval.x}
                y={g.approval.y}
                textAnchor="middle"
                fontSize={f - 0.5}
              >
                {lane.approval}
              </text>
            </g>

            <g className="mover">
              <rect {...box(g.mover)} rx={12} />
              <text
                className="t"
                x={g.mover.x}
                y={g.mover.y - (lane.moverExtra ? 16 : 8)}
                textAnchor="middle"
                fontSize={f + 2}
              >
                {lane.mover}
              </text>
              <text
                x={g.mover.x}
                y={g.mover.y + (lane.moverExtra ? 6 : 14)}
                textAnchor="middle"
                fontSize={f}
              >
                {lane.moverCall}
              </text>
              {lane.moverExtra && (
                <text
                  x={g.mover.x}
                  y={g.mover.y + 26}
                  textAnchor="middle"
                  fontSize={f}
                >
                  {lane.moverExtra}
                </text>
              )}
            </g>

            {/* Pacioli calls the contract that moves the tokens. */}
            <path
              className="a-dash call"
              d={g.call.d}
              pathLength={1}
              style={delay(0.2)}
            />
            <polygon
              className="a-pop call-head"
              points={arrowHead(
                g.call.end[0],
                g.call.end[1],
                g.call.from[0],
                g.call.from[1],
                10,
              )}
              style={delay(0.7)}
            />
            <text
              className="a-fade call-lbl"
              x={g.call.lx}
              y={g.call.ly}
              textAnchor={g.call.anchor}
              fontSize={f}
              style={delay(0.5)}
              transform={
                dg.compact ? `rotate(-90 ${g.call.lx} ${g.call.ly})` : undefined
              }
            >
              {dg.compact ? "Pacioli calls" : `Pacioli calls · ${lane.call}`}
            </text>

            <g className="escrow">
              <rect {...box(g.escrow)} rx={14} />
              <text
                className="t"
                x={g.escrow.x}
                y={g.escrow.y - 6}
                textAnchor="middle"
                fontSize={f + 4}
              >
                Pacioli
              </text>
              <text
                x={g.escrow.x}
                y={g.escrow.y + 16}
                textAnchor="middle"
                fontSize={f}
              >
                escrow · held
              </text>
            </g>
            <g className="a-fade check" style={delay(1.1)}>
              <text
                x={g.check.x}
                y={g.check.y + (dg.compact ? 0 : 10)}
                textAnchor="middle"
                fontSize={f - 0.5}
              >
                Δ balance == limit
              </text>
              <text
                className="err"
                x={g.check.x}
                y={g.check.y + (dg.compact ? 16 : 26)}
                textAnchor="middle"
                fontSize={f - 1}
              >
                else ShortFunding
              </text>
            </g>
          </g>
        </svg>

        <dl className="dg-facts" key={key}>
          <div>
            <dt>Call</dt>
            <dd>
              <code>{lane.call}</code>
            </dd>
          </div>
          <div>
            <dt>Payer signs</dt>
            <dd>
              <code>{lane.signs}</code> <span>({lane.signsNote})</span>
            </dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>
              {lane.approval === "no approval" ? (
                "None"
              ) : (
                <code>{lane.approval}</code>
              )}
            </dd>
          </div>
          <div>
            <dt>Moves the tokens</dt>
            <dd>
              <code>
                {lane.mover}.{lane.moverCall}
              </code>
            </dd>
          </div>
          <div>
            <dt>Bound to the terms</dt>
            <dd>{lane.binding}</dd>
          </div>
        </dl>
      </div>
    </Figure>
  );
}
