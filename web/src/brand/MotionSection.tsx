import { useEffect, useState } from "react";
import { SectionHead, delay } from "./Head.tsx";

const PRINCIPLES = [
  { name: "Post, don't bounce", text: "Things arrive like an entry being written: a short slide, then still. No springs, no overshoot." },
  { name: "One curve", text: "cubic-bezier(0.2, 0.7, 0.2, 1) everywhere. 150 ms for hover, 700 ms for entrances, 70–120 ms stagger." },
  { name: "Motion explains money", text: "Animate what changes in the books: an amount, a bar, a rule. Never decoration on its own." },
  { name: "Still is fine", text: "With reduced motion everything is simply there. Nothing depends on an animation finishing." },
];

const ENTRIES = [
  { what: "Charge #1", amount: 30 },
  { what: "Charge #2", amount: 12.5 },
  { what: "Charge #3", amount: 8 },
  { what: "Charge #4", amount: 21.25 },
];

const HELD = 100;

function RevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="demo-body">
      <div className="demo-reveal" key={run}>
        {[0, 1, 2].map((i) => (
          <i key={i} style={delay(i, 110)} />
        ))}
      </div>
      <button className="ghost small" onClick={() => setRun(run + 1)}>
        Replay
      </button>
    </div>
  );
}

function PostingDemo() {
  const [count, setCount] = useState(2);
  const posted = ENTRIES.slice(0, count);
  const left = HELD - posted.reduce((sum, e) => sum + e.amount, 0);
  return (
    <div className="demo-body">
      <div className="demo-ledger-wrap">
      <table className="demo-ledger">
        <caption className="sr-only">Posted entries</caption>
        <tbody>
          {posted.map((e) => (
            <tr key={e.what} className="post">
              <th scope="row">{e.what}</th>
              <td>−{e.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr key={count}>
            <th scope="row">Left</th>
            <td>{left.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
      <button
        className="ghost small"
        onClick={() => setCount(count >= ENTRIES.length ? 1 : count + 1)}
      >
        {count >= ENTRIES.length ? "Start over" : "Post entry"}
      </button>
    </div>
  );
}

const STAGES = ["Signed", "Held", "Charged", "Settled"];

function ProgressDemo() {
  const [stage, setStage] = useState(STAGES.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (stage >= STAGES.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStage(stage + 1), 700);
    return () => clearTimeout(t);
  }, [playing, stage]);
  const pct = (stage / (STAGES.length - 1)) * 100;
  return (
    <div className="demo-body">
      <div className="demo-progress">
        <div className="demo-track" role="progressbar" aria-label="Tab progress" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <ol>
          {STAGES.map((s, i) => (
            <li key={s} className={i <= stage ? "on" : undefined}>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <button
        className="ghost small"
        disabled={playing}
        onClick={() => {
          setStage(0);
          setPlaying(true);
        }}
      >
        Run the tab
      </button>
    </div>
  );
}

export function MotionSection() {
  return (
    <section className="section" id="motion">
      <div className="wrap">
        <SectionHead n="07" label="Motion" title={<>Moves like <em className="serif">a pen on paper.</em></>}>
          Short, exact and always about the numbers. Try the three patterns the site uses.
        </SectionHead>

        <ol className="principles">
          {PRINCIPLES.map((p, i) => (
            <li key={p.name} data-reveal="up" style={delay(i)}>
              <span className="principle-n">{String(i + 1).padStart(2, "0")}</span>
              <b>{p.name}</b>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>

        <div className="demos">
          <figure className="card demo" data-reveal="up" style={delay(0)}>
            <figcaption>
              <b>Reveal</b>
              <span>Sections rise 28 px and fade in, staggered.</span>
            </figcaption>
            <RevealDemo />
          </figure>
          <figure className="card demo" data-reveal="up" style={delay(1)}>
            <figcaption>
              <b>Posting an entry</b>
              <span>The row slides in, the balance updates.</span>
            </figcaption>
            <PostingDemo />
          </figure>
          <figure className="card demo" data-reveal="up" style={delay(2)}>
            <figcaption>
              <b>Progress</b>
              <span>One bar, filled stage by stage.</span>
            </figcaption>
            <ProgressDemo />
          </figure>
        </div>
      </div>
    </section>
  );
}
