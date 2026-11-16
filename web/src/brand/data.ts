/** Brand kit content: one place for the palette, art, type scale and voice. */

export type Swatch = {
  id: string;
  name: string;
  hex: string;
  use: string;
  /** Share of a typical page, in percent. The six add up to 100. */
  share: number;
};

export const COLORS: Swatch[] = [
  { id: "paper", name: "Drafting paper", hex: "#F3F2EC", use: "Page background under the grid", share: 55 },
  { id: "navy", name: "Blueprint navy", hex: "#0E1B3D", use: "Drawings, headings, the total row", share: 20 },
  { id: "cobalt", name: "Cobalt", hex: "#2A5BFF", use: "Actions, grid lines, links", share: 10 },
  { id: "lime", name: "Signal lime", hex: "#D4FF3A", use: "The one highlight: nav, tags, the double rule", share: 8 },
  { id: "coral", name: "Coral", hex: "#FF5B3A", use: "What leaves the books: errors, refunds", share: 5 },
  { id: "peach", name: "Peach", hex: "#FFD9A8", use: "Paper slips inside illustrations", share: 2 },
];

export const WHITE = "#FFFFFF";

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Grade = "AAA" | "AA" | "AA Large" | "Fail";

export function grade(ratio: number): Grade {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA Large";
  return "Fail";
}

/** Whichever of navy or white reads better on `bg`. */
export function inkFor(bg: string): string {
  const navy = "#0E1B3D";
  return contrast(navy, bg) >= contrast(WHITE, bg) ? navy : WHITE;
}

export const PAIRINGS: { fg: string; bg: string; note: string }[] = [
  { fg: "#0E1B3D", bg: "#F3F2EC", note: "Body text, headings" },
  { fg: "#F3F2EC", bg: "#0E1B3D", note: "Text on blueprint panels" },
  { fg: "#0E1B3D", bg: "#D4FF3A", note: "Nav, tags, highlights" },
  { fg: "#D4FF3A", bg: "#0E1B3D", note: "Accents on navy" },
  { fg: "#FFFFFF", bg: "#2A5BFF", note: "Primary buttons" },
  { fg: "#0E1B3D", bg: "#FF5B3A", note: "Refund and error chips" },
  { fg: "#0E1B3D", bg: "#FFD9A8", note: "Slips and receipts" },
  { fg: "#2A5BFF", bg: "#F3F2EC", note: "Links, large labels" },
  { fg: "#FF5B3A", bg: "#F3F2EC", note: "Never for text" },
];

export type Art = { id: string; title: string; caption: string };

export const ART: Art[] = [
  { id: "hero", title: "The whole tab", caption: "Sign, hold, meter and return on one sheet." },
  { id: "portrait", title: "Luca Pacioli, 1494", caption: "The namesake, ledger open." },
  { id: "sign", title: "Sign once", caption: "One signature opens the tab." },
  { id: "envelope", title: "Deposit", caption: "Funds drop into escrow." },
  { id: "vault", title: "Hold", caption: "Escrow keeps the money still." },
  { id: "meter", title: "Meter", caption: "Every call prints a receipt." },
  { id: "stamp", title: "Capture", caption: "The charge is stamped and booked." },
  { id: "balance", title: "Balance", caption: "Coins on one pan, the book on the other." },
  { id: "witness", title: "Witness", caption: "Anyone can check the receipts." },
];

export type TypeStep = {
  name: string;
  size: number;
  /** Viewport cap so large steps never overflow a phone. */
  vw: number;
  line: number;
  weight: number;
  family: "display" | "serif" | "mono";
  sample: string;
};

export const TYPE_SCALE: TypeStep[] = [
  { name: "Display XL", size: 104, vw: 13, line: 0.95, weight: 800, family: "display", sample: "Booked twice." },
  { name: "Display", size: 72, vw: 10, line: 1, weight: 800, family: "display", sample: "Open a tab." },
  { name: "Heading", size: 48, vw: 8, line: 1, weight: 800, family: "display", sample: "Held, charged, returned." },
  { name: "Accent", size: 40, vw: 8, line: 1.05, weight: 400, family: "serif", sample: "what you signed for." },
  { name: "Title", size: 24, vw: 6, line: 1.2, weight: 700, family: "display", sample: "The books balance after every call." },
  { name: "Lead", size: 19, vw: 5, line: 1.55, weight: 400, family: "display", sample: "Pacioli holds a payment and books every charge twice." },
  { name: "Body", size: 16, vw: 5, line: 1.6, weight: 400, family: "display", sample: "The rest goes back to the payer, in the same block." },
  { name: "Caption", size: 12, vw: 4, line: 1.4, weight: 500, family: "mono", sample: "HELD 100.00 · CHARGED 42.50" },
];

export const VOICE: [string, string][] = [
  ["The rest goes back to the payer.", "Seamless refunds powered by smart escrow."],
  ["One signature opens the tab.", "Frictionless one-click onboarding."],
  ["The books balance after every call.", "Bank-grade security you can trust."],
  ["Held 100.00. Charged 42.50. Returned 57.50.", "Unlock the future of payments."],
  ["Not audited. The demo token has no value.", "Enterprise-ready, battle-tested infrastructure."],
  ["Anyone can read the receipts.", "Radical transparency for the next billion users."],
];

export const WORDS_USE = ["held", "charged", "returned", "booked", "signed", "tab", "receipt", "balance", "payer", "payee"];
export const WORDS_AVOID = ["seamless", "frictionless", "revolutionary", "bank-grade", "unlock", "leverage", "magic", "next-gen", "disrupt"];
