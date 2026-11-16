import type { CSSProperties } from "react";
import {
  Figure,
  ReplayButton,
  cx,
  delay,
  textWidth,
  useDiagram,
} from "./diagram.tsx";

/** Seconds for the time cursor to sweep the whole axis. */
const SWEEP = 6.4;

interface Receipt {
  name: string;
  total: number;
  at: number;
}

const RECEIPTS: Receipt[] = [
  { name: "R1", total: 20, at: 0.1 },
  { name: "R2", total: 45, at: 0.27 },
  { name: "R3", total: 80, at: 0.56 },
];

const SETTLES = [
  { receipt: 1, at: 0.4, from: 0, to: 45 },
  { receipt: 2, at: 0.7, from: 45, to: 80 },
];

const REPLAY_AT = 0.88;
const LIMIT = 100;

function geometry(compact: boolean) {
  return compact
    ? {
        width: 380,
        height: 360,
        left: 40,
        right: 368,
        top: 44,
        bottom: 288,
        font: 11,
      }
    : {
        width: 780,
        height: 380,
        left: 70,
        right: 740,
        top: 48,
        bottom: 300,
        font: 12.5,
      };
}

export function ReceiptsDiagram() {
  const dg = useDiagram(0.35);
  const g = geometry(dg.compact);
  const f = g.font;
  const X = (t: number) => g.left + t * (g.right - g.left);
  const Y = (v: number) => g.bottom - (v / LIMIT) * (g.bottom - g.top - 14);
  const when = (t: number) => 0.2 + t * SWEEP;

  const signed = `M${X(0)} ${Y(0)}${RECEIPTS.map((r) => `H${X(r.at)}V${Y(r.total)}`).join("")}H${X(1)}`;
  const charged = `M${X(0)} ${Y(0)}${SETTLES.map((s) => `H${X(s.at)}V${Y(s.to)}`).join("")}H${X(1)}`;
  const stale = RECEIPTS[0];
  const finalCharged = SETTLES[SETTLES.length - 1].to;
  const rx = X(REPLAY_AT);
  const staleW = textWidth(`${stale.name} · ${stale.total}`, f) + 14;
  const clipId = `sweep-${dg.compact ? "n" : "w"}`;

  return (
    <Figure
      dg={dg}
      label="Fig. 4"
      title={
        <>
          Receipts only <em className="serif">ratchet up</em>
        </>
      }
      actions={<ReplayButton onClick={dg.replay} />}
      caption="Each settle pays the newest total minus what was already charged. R1 was never submitted, and R2 covers it. Replaying R1 later pays nothing: it reverts with StaleReceipt."
    >
      <svg
        className="dg-svg rcpt"
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label="Timeline: the payer signs receipts with running totals 20, 45 and 80. Settling R2 pays 45, settling R3 pays 35. Replaying R1 with total 20 reverts with StaleReceipt because 20 is not above the 80 already charged."
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              className="sweep-rect"
              x={g.left - 4}
              y={0}
              width={g.right - g.left + 8}
              height={g.height}
            />
          </clipPath>
        </defs>

        {/* Axes and grid. */}
        <g className="axis">
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                className={cx("grid", v === 0 && "base")}
                x1={g.left}
                x2={g.right}
                y1={Y(v)}
                y2={Y(v)}
              />
              <text
                x={g.left - 8}
                y={Y(v) + 4}
                textAnchor="end"
                fontSize={f - 1}
              >
                {v}
              </text>
            </g>
          ))}
          <text
            className="axis-t"
            x={g.left}
            y={g.bottom + 46}
            textAnchor="start"
            fontSize={f - 1}
          >
            time →
          </text>
          <text className="axis-t" x={g.left} y={g.top - 22} fontSize={f - 1}>
            running total
          </text>
          <line
            className="limit"
            x1={g.left}
            x2={g.right}
            y1={Y(LIMIT)}
            y2={Y(LIMIT)}
          />
          <text
            className="limit-t"
            x={g.right}
            y={Y(LIMIT) - 7}
            textAnchor="end"
            fontSize={f - 1}
          >
            limit · ExceedsHeld above
          </text>
        </g>

        <g key={dg.run} className="rcpt-play">
          <g clipPath={`url(#${clipId})`}>
            <path className="signed" d={signed} />
            <path className="charged" d={charged} />
          </g>
          <line
            className="cursor"
            x1={g.left}
            x2={g.left}
            y1={g.top - 6}
            y2={g.bottom}
            style={
              {
                transformOrigin: `${g.left}px 0px`,
                "--sweep": `${g.right - g.left}px`,
              } as CSSProperties
            }
          />

          {RECEIPTS.map((r) => {
            const label = `${r.name} · ${r.total}`;
            const w = textWidth(label, f) + 14;
            return (
              <g
                key={r.name}
                className="a-pop receipt"
                style={delay(when(r.at))}
              >
                <circle cx={X(r.at)} cy={Y(r.total)} r={5.5} />
                <rect
                  x={X(r.at) - w / 2}
                  y={Y(r.total) - 34}
                  width={w}
                  height={22}
                  rx={5}
                />
                <text
                  x={X(r.at)}
                  y={Y(r.total) - 18.5}
                  textAnchor="middle"
                  fontSize={f}
                >
                  {label}
                </text>
              </g>
            );
          })}

          {SETTLES.map((s) => {
            const x = X(s.at);
            const paid = s.to - s.from;
            const label = dg.compact
              ? `+${paid}`
              : `pays ${s.to} − ${s.from} = ${paid}`;
            return (
              <g key={s.at} className="settle" style={delay(when(s.at))}>
                <rect
                  className="a-grow payout"
                  x={x - 7}
                  y={Y(s.to)}
                  width={14}
                  height={Y(s.from) - Y(s.to)}
                  style={{ transformOrigin: `${x}px ${Y(s.from)}px` }}
                />
                <g className="a-fade">
                  <text
                    className="settle-t"
                    x={x}
                    y={g.bottom + 22}
                    textAnchor="middle"
                    fontSize={f - 1}
                  >
                    settle({RECEIPTS[s.receipt].name})
                  </text>
                  <text
                    className="paid"
                    x={x + 12}
                    y={(Y(s.from) + Y(s.to)) / 2 + 4}
                    fontSize={f}
                  >
                    {label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* The replayed old receipt rises to the charged line and bounces off. */}
          <g className="replay" style={delay(when(REPLAY_AT))}>
            <line
              className="a-fade wall"
              x1={rx - 22}
              x2={rx + 22}
              y1={Y(finalCharged)}
              y2={Y(finalCharged)}
            />
            <g
              className="bouncer"
              style={
                {
                  "--rise": `${Y(stale.total) - Y(finalCharged) - 14}px`,
                } as CSSProperties
              }
            >
              <rect
                x={rx - staleW / 2}
                y={Y(stale.total) - 11}
                width={staleW}
                height={22}
                rx={5}
              />
              <text
                x={rx}
                y={Y(stale.total) + 4}
                textAnchor="middle"
                fontSize={f}
              >
                {stale.name} · {stale.total}
              </text>
            </g>
            <g className="a-fade stale" style={delay(when(REPLAY_AT) + 1)}>
              <text
                className="settle-t"
                x={rx}
                y={g.bottom + (dg.compact ? 38 : 22)}
                textAnchor="middle"
                fontSize={f - 1}
              >
                settle({stale.name})
              </text>
              <text
                x={rx}
                y={Y((stale.total + finalCharged) / 2) + 4}
                textAnchor="middle"
                fontSize={f}
              >
                ✕
              </text>
              <text
                className="err"
                x={rx}
                y={Y(stale.total) + 30}
                textAnchor="middle"
                fontSize={f}
              >
                StaleReceipt
              </text>
              {!dg.compact && (
                <text
                  className="why"
                  x={rx}
                  y={Y(stale.total) + 46}
                  textAnchor="middle"
                  fontSize={f - 1.5}
                >
                  {stale.total} ≤ charged {finalCharged}
                </text>
              )}
            </g>
          </g>
        </g>
      </svg>
      <ol className="dg-legend">
        <li>
          <i className="sw sign" /> total the payer signed
        </li>
        <li>
          <i className="sw charged" /> charged on-chain
        </li>
        <li>
          <i className="sw pay" /> paid by a settle
        </li>
        <li>
          <i className="sw back" /> reverted
        </li>
      </ol>
    </Figure>
  );
}
