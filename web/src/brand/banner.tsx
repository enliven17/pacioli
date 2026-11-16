// The 1280x640 banner used for the README and link previews. Rendered at
// /banner/ and captured to an image; see the brand kit.
import "../ui/fonts.ts";
import "../ui/base.css";
import "./banner.css";
import { createRoot } from "react-dom/client";
import { Mark } from "../ui/Shell.tsx";

createRoot(document.getElementById("root")!).render(
  <div className="banner blueprint">
    <div className="copy">
      <span className="banner-logo">
        <Mark tile="#D4FF3A" ink="#0E1B3D" rule="#FF5B3A" />
        pacioli
      </span>
      <h1>
        Every payment,
        <br />
        booked <em className="serif">twice.</em>
      </h1>
      <p>Auth-capture escrow in Fe · Permit2 · ERC-3009 · metered receipts</p>
    </div>
    <img src="/art/hero.webp" alt="" />
    <div className="equation">limit = held + charged + released</div>
  </div>,
);
