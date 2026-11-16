import { VOICE, WORDS_AVOID, WORDS_USE } from "./data.ts";
import { SectionHead, Verdict, delay } from "./Head.tsx";

export function VoiceSection() {
  return (
    <section className="section" id="voice">
      <div className="wrap">
        <SectionHead n="08" label="Voice" title={<>Say what <em className="serif">the contract does.</em></>}>
          Short sentences, real numbers, no hype. If a line would fit on any other product's landing
          page, it isn't ours.
        </SectionHead>

        <ul className="voice">
          {VOICE.map(([yes, no], i) => (
            <li key={yes} data-reveal="up" style={delay(i % 3)}>
              <div className="voice-card yes">
                <Verdict kind="say" />
                <p>{yes}</p>
              </div>
              <div className="voice-card no">
                <Verdict kind="not" />
                <p>
                  <s>{no}</s>
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="words">
          <article className="card" data-reveal="up">
            <h3>Words we use</h3>
            <ul className="word-list use">
              {WORDS_USE.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </article>
          <article className="card" data-reveal="up" style={delay(1)}>
            <h3>Words we avoid</h3>
            <ul className="word-list avoid">
              {WORDS_AVOID.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
