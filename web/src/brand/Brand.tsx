import { Footer, Mark, Nav } from "../ui/Shell.tsx";
import { ArtSection } from "./ArtSection.tsx";
import { ColorSection } from "./ColorSection.tsx";
import { ComponentsSection } from "./ComponentsSection.tsx";
import { Construction } from "./Construction.tsx";
import { GridSection } from "./GridSection.tsx";
import { SectionHead, delay } from "./Head.tsx";
import { LogoSection } from "./LogoSection.tsx";
import { MotionSection } from "./MotionSection.tsx";
import { TypeSection } from "./TypeSection.tsx";
import { VoiceSection } from "./VoiceSection.tsx";
import "./sections.css";

const CONTENTS = [
  ["#logo", "Logo"],
  ["#color", "Color"],
  ["#type", "Type"],
  ["#grid", "Grid"],
  ["#components", "Components"],
  ["#illustration", "Illustration"],
  ["#motion", "Motion"],
  ["#voice", "Voice"],
  ["#downloads", "Downloads"],
];

const FACTS = [
  ["1494", "Pacioli prints double entry"],
  ["6", "inks in the palette"],
  ["3", "type families"],
  ["24 px", "the grid everything snaps to"],
];

function Hero() {
  return (
    <section className="brand-hero">
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="tag" data-reveal="up">
              Brand kit
            </span>
            <h1 data-reveal="up" style={delay(1)}>
              A ledger, drawn <em className="serif">on blueprint paper.</em>
            </h1>
            <p className="hero-lead" data-reveal="up" style={delay(2)}>
              Pacioli is named for the mathematician who first printed double-entry bookkeeping. The
              brand pairs an accountant's ledger with an engineer's drawing: exact, ruled, and a
              little bit loud.
            </p>
            <p className="hero-tagline" data-reveal="up" style={delay(3)}>
              <span>Tagline</span>
              Every payment, <em className="serif">booked twice.</em>
            </p>
          </div>
          <div data-reveal="right" style={delay(2)}>
            <Construction />
          </div>
        </div>

        <dl className="facts">
          {FACTS.map(([v, k], i) => (
            <div key={k} data-reveal="up" style={delay(i)}>
              <dt>{v}</dt>
              <dd>{k}</dd>
            </div>
          ))}
        </dl>

        <nav className="contents" aria-label="Brand kit sections" data-reveal="up">
          {CONTENTS.map(([href, label], i) => (
            <a key={href} href={href}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

function Downloads() {
  return (
    <section className="section" id="downloads">
      <div className="wrap">
        <SectionHead n="09" label="Downloads" title={<>Take it <em className="serif">with you.</em></>}>
          The files the site itself uses. Please keep them as they are.
        </SectionHead>
        <div className="downloads">
          <a className="card download" href="/favicon.svg" download data-reveal="up" style={delay(0)}>
            <span className="download-preview on-lime">
              <Mark />
            </span>
            <span className="download-meta">
              <b>Mark</b>
              <small>favicon.svg · vector</small>
            </span>
            <span className="download-cta">Download</span>
          </a>
          <a className="card download" href="/og.png" download data-reveal="up" style={delay(1)}>
            <span className="download-preview">
              <img src="/og.png" alt="" loading="lazy" />
            </span>
            <span className="download-meta">
              <b>Social card</b>
              <small>og.png · 1280 × 640</small>
            </span>
            <span className="download-cta">Download</span>
          </a>
          <a className="card download" href="/banner/" data-reveal="up" style={delay(2)}>
            <span className="download-preview blueprint">
              <span className="download-word">pacioli</span>
            </span>
            <span className="download-meta">
              <b>README banner</b>
              <small>/banner/ · live page</small>
            </span>
            <span className="download-cta">Open</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function Brand() {
  return (
    <>
      <Nav current="/brand/" />
      <main className="brand">
        <Hero />
        <LogoSection />
        <ColorSection />
        <TypeSection />
        <GridSection />
        <ComponentsSection />
        <ArtSection />
        <MotionSection />
        <VoiceSection />
        <Downloads />
      </main>
      <Footer />
    </>
  );
}
