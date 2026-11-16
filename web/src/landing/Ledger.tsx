import { useState } from "react";

type Books = { held: number; charged: number; released: number; refunded: number };
type Entry = { call: string; debit: string; credit: string; amount: number };

const LIMIT = 100;
const START: Books = { held: LIMIT, charged: 0, released: 0, refunded: 0 };
const OPENED: Entry = { call: "open", debit: "held", credit: "payer", amount: LIMIT };

const fmt = (n: number) => n.toFixed(2);

/** A client-side tab that posts every movement to two accounts, as the contract does. */
export function Ledger() {
  const [books, setBooks] = useState(START);
  const [journal, setJournal] = useState<Entry[]>([OPENED]);
  const closed = books.held === 0;
  const refundable = books.charged - books.refunded;

  const post = (entry: Entry, next: Books) => {
    setBooks(next);
    setJournal((j) => [entry, ...j].slice(0, 6));
  };

  const charge = () => {
    const amount = Math.min(books.held, 12.5);
    post(
      { call: "charge", debit: "charged", credit: "held", amount },
      { ...books, held: books.held - amount, charged: books.charged + amount },
    );
  };
  const refund = () => {
    const amount = Math.min(refundable, 2.5);
    post({ call: "refund", debit: "refunded", credit: "merchant", amount }, { ...books, refunded: books.refunded + amount });
  };
  const close = () =>
    post(
      { call: "close", debit: "released", credit: "held", amount: books.held },
      { ...books, held: 0, released: books.released + books.held },
    );
  const reset = () => {
    setBooks(START);
    setJournal([OPENED]);
  };

  const total = books.held + books.charged + books.released;
  const accounts: [string, number, string][] = [
    ["Held", books.held, "in escrow"],
    ["Charged", books.charged, "paid to the merchant"],
    ["Released", books.released, "returned to the payer"],
  ];

  return (
    <div className="ledger card">
      <div className="ledger-accounts">
        {accounts.map(([name, value, note]) => (
          <div className="account" key={name}>
            <span>{name}</span>
            <b>{fmt(value)}</b>
            <small>{note}</small>
            <i style={{ width: `${(value / LIMIT) * 100}%` }} />
          </div>
        ))}
        <div className="account total">
          <span>Limit</span>
          <b>{fmt(total)}</b>
          <small>{total === LIMIT ? "balanced" : "out of balance"}</small>
        </div>
        <div className="account side">
          <span>Refunded</span>
          <b>{fmt(books.refunded)}</b>
          <small>never more than charged</small>
        </div>
      </div>

      <div className="ledger-journal">
        <div className="ledger-actions">
          <button disabled={closed} onClick={charge}>
            Charge 12.50
          </button>
          <button className="ghost" disabled={refundable <= 0} onClick={refund}>
            Refund 2.50
          </button>
          <button className="lime" disabled={closed} onClick={close}>
            Close tab
          </button>
          <button className="ghost" onClick={reset}>
            Reset
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Call</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((entry, index) => (
              <tr key={journal.length - index}>
                <td>{entry.call}</td>
                <td>{entry.debit}</td>
                <td>{entry.credit}</td>
                <td>{fmt(entry.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="equation">
          {fmt(books.held)} + {fmt(books.charged)} + {fmt(books.released)} = <b>{fmt(total)}</b>
        </p>
      </div>
    </div>
  );
}
