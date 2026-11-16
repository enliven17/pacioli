import {
  Figure,
  ReplayButton,
  arrowHead,
  cx,
  delay,
  textWidth,
  useDiagram,
} from "./diagram.tsx";

type Lane = 0 | 1 | 2 | 3;
type Tone = "ink" | "sign" | "pay" | "back";

type Step =
  | {
      kind: "msg";
      from: Lane;
      to: Lane;
      label: string;
      short?: string;
      tone?: Tone;
      gap?: number;
    }
  | { kind: "self"; at: Lane; label: string; short?: string; gap?: number };

interface Frame {
  op: "alt" | "loop" | "opt";
  guard: string;
  from: number;
  to: number;
  /** Space reserved above the first row for the frame header. */
  top?: number;
  inset?: number;
  split?: { at: number; guard: string; top?: number };
}

const ACTORS = [
  { name: "Payer", short: "Payer" },
  { name: "Merchant", short: "Merchant" },
  { name: "Pacioli", short: "Pacioli" },
  { name: "Token · Permit2", short: "Token" },
] as const;

const STEPS: Step[] = [
  {
    kind: "msg",
    from: 0,
    to: 1,
    label: "signs Authorization (EIP-712)",
    short: "signs Authorization",
    tone: "sign",
  },
  {
    kind: "msg",
    from: 1,
    to: 2,
    label: "open*(auth, sig) · before openBy",
    short: "open*(auth, sig)",
  },
  {
    kind: "msg",
    from: 2,
    to: 3,
    label: "pull limit from payer",
    short: "pull limit",
  },
  {
    kind: "self",
    at: 2,
    label: "balance Δ == limit · held = limit",
    short: "Δ == limit",
  },
  {
    kind: "msg",
    from: 1,
    to: 2,
    label: "charge(id, amount)",
    short: "charge(id, amt)",
    gap: 30,
  },
  {
    kind: "msg",
    from: 2,
    to: 3,
    label: "transfer amount → merchant",
    short: "amt → merchant",
    tone: "pay",
  },
  {
    kind: "msg",
    from: 0,
    to: 1,
    label: "signs Receipt(tab, total)",
    short: "signs Receipt",
    tone: "sign",
    gap: 44,
  },
  {
    kind: "msg",
    from: 1,
    to: 2,
    label: "settle(id, total, sig) · anyone",
    short: "settle(…)",
  },
  {
    kind: "msg",
    from: 2,
    to: 3,
    label: "transfer total − charged → merchant",
    short: "Δ → merchant",
    tone: "pay",
  },
  { kind: "msg", from: 1, to: 2, label: "close(id)", gap: 34 },
  {
    kind: "msg",
    from: 0,
    to: 2,
    label: "reclaim(id) · anyone",
    short: "reclaim(id)",
    gap: 16,
  },
  {
    kind: "msg",
    from: 2,
    to: 3,
    label: "transfer held → payer",
    short: "held → payer",
    tone: "back",
    gap: 12,
  },
  {
    kind: "msg",
    from: 1,
    to: 2,
    label: "refund(id, amount)",
    short: "refund(id, amt)",
    gap: 18,
  },
  {
    kind: "msg",
    from: 2,
    to: 3,
    label: "transferFrom merchant → payer",
    short: "merchant → payer",
    tone: "back",
  },
];

const FRAMES: Frame[] = [
  {
    op: "alt",
    guard: "[unmetered]",
    from: 4,
    to: 8,
    split: { at: 6, guard: "[metered]", top: 72 },
  },
  { op: "loop", guard: "[each receipt]", from: 6, to: 8, inset: 12, top: 46 },
  {
    op: "alt",
    guard: "[merchant, before captureBy]",
    from: 9,
    to: 10,
    split: { at: 10, guard: "[anyone, after captureBy]" },
  },
  { op: "opt", guard: "[refund, up to charged]", from: 12, to: 13 },
];

const ROW = 44;
const STAGGER = 0.42;
const rowDelay = (i: number) => 0.35 + i * STAGGER;

function layout(compact: boolean) {
  const width = compact ? 380 : 820;
  const lanes = compact ? [44, 138, 238, 336] : [92, 306, 524, 734];
  const font = compact ? 11.5 : 12.5;
  const head = {
    top: 14,
    height: compact ? 30 : 34,
    width: compact ? 78 : 132,
  };
  let y = head.top + head.height + 46;
  const rows = STEPS.map((step, i) => {
    if (i > 0) y += ROW + (step.gap ?? 0);
    return y;
  });
  const height = rows[rows.length - 1] + 44;
  return { width, height, lanes, font, head, rows };
}

export function SequenceDiagram() {
  const dg = useDiagram(0.2);
  const { width, height, lanes, font, head, rows } = layout(dg.compact);
  const left = lanes[0] - (dg.compact ? 36 : 56);
  const right = lanes[3] + (dg.compact ? 36 : 56);

  const clampLabel = (center: number, text: string) => {
    const half = textWidth(text, font) / 2 + 6;
    return Math.min(width - half - 2, Math.max(half + 2, center));
  };

  return (
    <Figure
      dg={dg}
      label="Fig. 1"
      title={
        <>
          The life of a tab, <em className="serif">call by call</em>
        </>
      }
      actions={<ReplayButton onClick={dg.replay} />}
      caption="Dashed messages are signatures made off-chain. Pacioli never holds a key: every movement is a call someone makes against a signed term."
    >
      <svg
        className="dg-svg seq"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="seq-title seq-desc"
      >
        <title id="seq-title">Sequence diagram of a Pacioli tab</title>
        <desc id="seq-desc">
          The payer signs an authorization; the merchant or anyone opens the
          tab, and Pacioli pulls the limit from the payer through the token or
          Permit2. On an unmetered tab the merchant charges; on a metered tab
          the payer signs receipts and anyone settles them. Before the capture
          deadline the merchant may close, after it anyone may reclaim; either
          way the held remainder goes back to the payer. The merchant may refund
          up to what it charged.
        </desc>

        {/* Lifelines and heads stay put; everything else replays. */}
        {lanes.map((x, i) => (
          <g key={i} className={cx("seq-actor", i === 2 && "core")}>
            <line
              className="lifeline"
              x1={x}
              x2={x}
              y1={head.top + head.height}
              y2={height - 14}
            />
            <rect
              x={x - head.width / 2}
              y={head.top}
              width={head.width}
              height={head.height}
              rx={8}
            />
            <text
              x={x}
              y={head.top + head.height / 2 + 4.5}
              textAnchor="middle"
              fontSize={font + 1}
            >
              {dg.compact ? ACTORS[i].short : ACTORS[i].name}
            </text>
            <path className="tick" d={`M${x - 6} ${height - 14}h12`} />
          </g>
        ))}

        <g key={dg.run} className="seq-play">
          {FRAMES.map((frame, i) => {
            const inset = frame.inset ?? 0;
            const top = rows[frame.from] - (frame.top ?? 44);
            const bottom = rows[frame.to] + 16 - inset / 2;
            const x = left + inset;
            const w = right - left - inset * 2;
            const tagW = textWidth(frame.op, font) + 16;
            return (
              <g
                key={i}
                className={cx("frame", "a-fade", frame.op)}
                style={delay(rowDelay(frame.from) - 0.15)}
              >
                <rect x={x} y={top} width={w} height={bottom - top} rx={6} />
                <path
                  className="frame-tag"
                  d={`M${x} ${top}h${tagW}v10l-6 7h-${tagW - 6}z`}
                />
                <text
                  className="frame-op"
                  x={x + 7}
                  y={top + 12.5}
                  fontSize={font - 0.5}
                >
                  {frame.op}
                </text>
                <text
                  className="guard"
                  x={x + tagW + 8}
                  y={top + 12.5}
                  fontSize={font - 0.5}
                >
                  {frame.guard}
                </text>
                {frame.split && (
                  <g
                    className="a-fade"
                    style={delay(rowDelay(frame.split.at) - 0.15)}
                  >
                    <line
                      className="split"
                      x1={x}
                      x2={x + w}
                      y1={rows[frame.split.at] - (frame.split.top ?? 44)}
                      y2={rows[frame.split.at] - (frame.split.top ?? 44)}
                    />
                    <text
                      className="guard"
                      x={x + 8}
                      y={rows[frame.split.at] - (frame.split.top ?? 44) + 15}
                      fontSize={font - 0.5}
                    >
                      {frame.split.guard}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {STEPS.map((step, i) => {
            const y = rows[i];
            const text = dg.compact ? (step.short ?? step.label) : step.label;
            if (step.kind === "self") {
              const x = lanes[step.at];
              return (
                <g key={i} className="msg ink" style={delay(rowDelay(i))}>
                  <path
                    className="a-fade line"
                    d={`M${x} ${y - 8}h24v16h-22`}
                  />
                  <polygon
                    className="a-pop head"
                    points={arrowHead(x + 1, y + 8, x + 12, y + 8)}
                  />
                  <text
                    className="a-fade lbl"
                    x={x - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={font}
                  >
                    {text}
                  </text>
                </g>
              );
            }
            const x1 = lanes[step.from];
            const x2 = lanes[step.to];
            const dir = Math.sign(x2 - x1);
            const end = x2 - dir * 2;
            const center = clampLabel((x1 + x2) / 2, text);
            const tw = textWidth(text, font);
            return (
              <g
                key={i}
                className={cx("msg", step.tone ?? "ink")}
                style={delay(rowDelay(i))}
              >
                {(step.tone === "pay" || step.tone === "back") && (
                  <rect
                    className="a-fade hl"
                    x={center - tw / 2 - 5}
                    y={y - 9 - font}
                    width={tw + 10}
                    height={font + 7}
                    rx={4}
                  />
                )}
                <line
                  className="a-draw line"
                  x1={x1}
                  x2={end}
                  y1={y}
                  y2={y}
                  style={{ transformOrigin: `${x1}px ${y}px` }}
                />
                <polygon
                  className="a-pop head"
                  points={arrowHead(end, y, x1, y, 9)}
                />
                <circle className="a-pop dot" cx={x1} cy={y} r={3} />
                <text
                  className="a-fade lbl"
                  x={center}
                  y={y - 9}
                  textAnchor="middle"
                  fontSize={font}
                >
                  {text}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <ol className="dg-legend">
        <li>
          <i className="sw sign" /> signature, off-chain
        </li>
        <li>
          <i className="sw ink" /> call or transfer
        </li>
        <li>
          <i className="sw pay" /> paid to the merchant
        </li>
        <li>
          <i className="sw back" /> returned to the payer
        </li>
      </ol>
    </Figure>
  );
}
