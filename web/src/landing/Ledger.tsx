import { useEffect, useRef, useState } from "react";
import { useInView } from "../ui/motion.ts";

type Books = { held: number; charged: number; released: number; refunded: number };
type Entry = { id: number; call: string; debit: string; credit: string; amount: number };

const LIMIT = 100;
const START: Books = { held: LIMIT, charged: 0, released: 0, refunded: 0 };
const AMOUNTS = [5, 12.5, 25];

const fmt = (n: number) => n.toFixed(2);

/** The scripted run that plays once the ledger scrolls into view. */
const SCRIPT: [string, number][] = [
  ["charge", 12.5],
  ["charge", 25],
  ["refund", 2.5],
  ["charge", 5],
  ["close", 0],
];

/**
 * A client-side tab, drawn as a ledger book: the balance on the left page,
 * the journal on the right. Every call posts one debit and one credit, as the
 * contract does.
 */
export function Ledger() {
  const [books, setBooks] = useState(START);
  const [journal, setJournal] = useState<Entry[]>([
    { id: 0, call: "open", debit: "held", credit: "payer", amount: LIMIT },
  ]);
  const [step, setStep] = useState(12.5);
  const [playing, setPlaying] = useState(false);
  const [ref, seen] = useInView<HTMLDivElement>(0.4);
  const next = useRef(1);
  const timer = useRef<number>(undefined);

  const closed = books.held === 0;
  const refundable = books.charged - books.refunded;

  const apply = (call: string, value: number, b: Books): [Books, Entry] | undefined => {
    const id = next.current++;
    if (call === "charge" && b.held > 0) {
      const amount = Math.min(b.held, value);
      return [{ ...b, held: b.held - amount, charged: b.charged + amount }, { id, call, debit: "charged", credit: "held", amount }];
    }
    if (call === "refund" && b.charged - b.refunded > 0) {
      const amount = Math.min(b.charged - b.refunded, value);
      return [{ ...b, refunded: b.refunded + amount }, { id, call, debit: "refunded", credit: "merchant", amount }];
    }
    if (call === "close" && b.held > 0) {
      return [{ ...b, held: 0, released: b.released + b.held }, { id, call, debit: "released", credit: "held", amount: b.held }];
    }
    return undefined;
  };

  const current = useRef(START);
  current.current = books;

  const post = (call: string, value: number) => {
    const result = apply(call, value, current.current);
    if (!result) return;
    current.current = result[0];
    setBooks(result[0]);
    setJournal((j) => [result[1], ...j].slice(0, 7));
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    setPlaying(false);
    current.current = START;
    setBooks(START);
    setJournal([{ id: next.current++, call: "open", debit: "held", credit: "payer", amount: LIMIT }]);
  };

  const play = () => {
    reset();
    setPlaying(true);
    SCRIPT.forEach(([call, value], i) => {
      timer.current = window.setTimeout(() => {
        post(call, value);
        if (i === SCRIPT.length - 1) setPlaying(false);
      }, 900 * (i + 1));
    });
  };

  useEffect(() => {
    if (seen && !matchMedia("(prefers-reduced-motion: reduce)").matches) play();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const total = books.held + books.charged + books.released;
  const segments: [string, number, string][] = [
    ["held", books.held, "In escrow"],
    ["charged", books.charged, "To the merchant"],
    ["released", books.released, "Back to the payer"],
  ];

  return (
    <div className="book" ref={ref}>
      <div className="page left">
        <header>
          <span className="page-label">Balance</span>
          <span className="mono">tab 0x8e54…a94f</span>
        </header>

        <div className="stack" aria-label="Limit split into accounts">
          {segments.map(([key, value]) => (
            <i key={key} className={key} style={{ flexGrow: value }} />
          ))}
        </div>

        <ul className="accounts">
          {segments.map(([key, value, note]) => (
            <li key={key}>
              <i className={key} />
              <span>
                <b>{key}</b>
                <small>{note}</small>
              </span>
              <output className="mono">{fmt(value)}</output>
            </li>
          ))}
          <li className="sum">
            <span>
              <b>limit</b>
              <small>{total === LIMIT ? "balanced" : "out of balance"}</small>
            </span>
            <output className="mono">{fmt(total)}</output>
          </li>
          <li className="aside">
            <i className="refunded" />
            <span>
              <b>refunded</b>
              <small>never more than charged</small>
            </span>
            <output className="mono">{fmt(books.refunded)}</output>
          </li>
        </ul>
      </div>

      <div className="page right">
        <header>
          <span className="page-label">Journal</span>
          <span className={playing ? "live on" : "live"}>{playing ? "posting…" : "ready"}</span>
        </header>

        <div className="journal" role="table" aria-label="Journal entries">
          <div className="row head" role="row">
            <span>Call</span>
            <span>Debit</span>
            <span>Credit</span>
            <span>Amount</span>
          </div>
          {journal.map((entry) => (
            <div className={`row ${entry.call}`} role="row" key={entry.id}>
              <span>{entry.call}</span>
              <span>{entry.debit}</span>
              <span>{entry.credit}</span>
              <span className="mono">{fmt(entry.amount)}</span>
            </div>
          ))}
        </div>

        <p className="equation mono">
          {fmt(books.held)} + {fmt(books.charged)} + {fmt(books.released)} = <b>{fmt(total)}</b>
        </p>

        <div className="controls">
          <div className="chips" role="radiogroup" aria-label="Amount">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                role="radio"
                aria-checked={step === a}
                className={step === a ? "chip on" : "chip"}
                onClick={() => setStep(a)}
              >
                {fmt(a)}
              </button>
            ))}
          </div>
          <div className="actions">
            <button disabled={closed || playing} onClick={() => post("charge", step)}>
              Charge
            </button>
            <button className="ghost" disabled={refundable <= 0 || playing} onClick={() => post("refund", step)}>
              Refund
            </button>
            <button className="lime" disabled={closed || playing} onClick={() => post("close", 0)}>
              Close
            </button>
            <button className="ghost" disabled={playing} onClick={play}>
              Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
