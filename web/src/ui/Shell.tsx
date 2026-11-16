import { useState, type ReactNode } from "react";
import { useReveal, useScrollVars } from "./motion.ts";
import deployment from "../deployment.json";

export const REPO = "https://github.com/enliven17/pacioli";

/** The mark: a P over the accountant's double rule, the sign that a column is closed and balanced. */
export function Mark({ tile = "#0E1B3D", ink = "#D4FF3A", rule = "#FF5B3A" }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill={tile} />
      <path
        fill={ink}
        fillRule="evenodd"
        d="M13 8h12.5a9.5 9.5 0 0 1 0 19H20v6h-7zm7 6v7h5a3.5 3.5 0 0 0 0-7z"
      />
      <rect x="13" y="36" width="23" height="2.6" rx="1.3" fill={ink} />
      <rect x="13" y="40.6" width="23" height="2.6" rx="1.3" fill={rule} />
    </svg>
  );
}

export function Logo(props: { tile?: string; ink?: string; rule?: string }) {
  return (
    <a className="logo" href="/" aria-label="Pacioli home">
      <Mark {...props} />
      pacioli
    </a>
  );
}

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#ledger", label: "The ledger" },
  { href: "/#fe", label: "Built in Fe" },
  { href: "/docs/", label: "Docs" },
  { href: "/brand/", label: "Brand" },
];

export function Nav({ current, children }: { current?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  useReveal();
  useScrollVars();
  return (
    <header className="bar">
      <i className="progress" aria-hidden="true" />
      <div className="wrap">
        <div className="pill">
          <Logo />
          <nav aria-label="Main" className={open ? "open" : undefined}>
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.href === current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <button className="ghost menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            Menu
          </button>
          {children ?? (
            <a className="button" href="/app/">
              Open the demo
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

const NETWORKS: Record<number, { name: string; explorer?: string }> = {
  31337: { name: "Anvil (local)" },
  11155111: { name: "Sepolia", explorer: "https://sepolia.etherscan.io/address/" },
};

function Contract({ label, address }: { label: string; address: string }) {
  const explorer = NETWORKS[deployment.chainId]?.explorer;
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{explorer ? <a href={explorer + address}>{short}</a> : short}</dd>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="foot blueprint">
      <div className="wrap">
        <div className="foot-top">
          <h2>
            Every payment, <em className="serif">booked twice.</em>
          </h2>
          <div className="foot-cta">
            <a className="button lime" href="/app/">
              Open a tab
            </a>
            <a className="button ghost" href={REPO}>
              Source on GitHub
            </a>
          </div>
        </div>

        <div className="foot-grid">
          <nav aria-label="Product">
            <h4>Product</h4>
            <a href="/">Overview</a>
            <a href="/app/">Demo</a>
            <a href="/docs/">Docs</a>
            <a href="/brand/">Brand kit</a>
          </nav>
          <nav aria-label="Developers">
            <h4>Developers</h4>
            <a href="/docs/#quickstart">Quick start</a>
            <a href="/docs/#funding">Funding sources</a>
            <a href="/docs/#receipts">Metered receipts</a>
            <a href="/docs/#calls">Calls and errors</a>
          </nav>
          <nav aria-label="Project">
            <h4>Project</h4>
            <a href={REPO}>GitHub</a>
            <a href={`${REPO}/blob/main/src/lib.fe`}>The contract</a>
            <a href="https://fe-lang.org">Fe language</a>
            <a href="https://fe-lang.org/contest/">Fe Builders Challenge</a>
          </nav>
          <dl className="foot-slip">
            <div>
              <dt>Network</dt>
              <dd>{NETWORKS[deployment.chainId]?.name ?? deployment.chainId}</dd>
            </div>
            <Contract label="Pacioli" address={deployment.pacioli} />
            <Contract label="Demo Dollar" address={deployment.token} />
            <Contract label="Permit2" address={deployment.permit2} />
            <div>
              <dt>Fe</dt>
              <dd>26.6.0</dd>
            </div>
          </dl>
        </div>

        <div className="foot-end">
          <span>Not audited. The demo uses a test token with no value.</span>
          <span>Apache-2.0 · Built for the Fe Builders Challenge 2026</span>
        </div>
      </div>
    </footer>
  );
}
