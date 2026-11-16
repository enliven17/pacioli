import { ART } from "./data.ts";
import { SectionHead, Verdict, delay } from "./Head.tsx";

const DO = [
  "Bold ink outlines, one weight per drawing",
  "Halftone dots for shade, never soft gradients",
  "Dimension lines, center marks, construction circles",
  "Only the six brand colors, on paper or navy",
];

const DONT = [
  "Words or numbers inside the picture",
  "Photos, 3D renders or glossy lighting",
  "Faces with brand logos or real people other than Pacioli",
  "Drop shadows, glows, neon",
];

export function ArtSection() {
  return (
    <section className="section" id="illustration">
      <div className="wrap">
        <SectionHead n="06" label="Illustration" title={<>Engineering drawings <em className="serif">of money.</em></>}>
          Every illustration is an object from the ledger drawn like a patent sheet: annotated,
          measured, and printed in the six brand inks. Hover to look closer.
        </SectionHead>

        <div className="gallery">
          {ART.map((a, i) => (
            <figure key={a.id} className={`art ${a.id}`} data-reveal="up" style={delay(i % 4)}>
              <div className="art-frame">
                <img src={`/art/${a.id}.webp`} alt={`${a.title}: ${a.caption}`} loading="lazy" decoding="async" />
              </div>
              <figcaption>
                <b>
                  <span className="art-n">{String(i + 1).padStart(2, "0")}</span>
                  {a.title}
                </b>
                <span>{a.caption}</span>
              </figcaption>
            </figure>
          ))}

          <article className="card rule-card" data-reveal="up">
            <Verdict kind="do" />
            <ul>
              {DO.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </article>
          <article className="card rule-card" data-reveal="up" style={delay(1)}>
            <Verdict kind="dont" />
            <ul>
              {DONT.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
