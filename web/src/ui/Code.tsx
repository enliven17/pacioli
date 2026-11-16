import { useState, type ReactNode } from "react";

const KEYWORDS = new Set(
  "pub fn trait impl struct msg contract recv uses mut let var if else return match for while use const self Self true false async await import from export type as new".split(
    " ",
  ),
);
const TYPES = /^(u8|u256|bool|Address|Bytes|Bytes32|Timestamp|Ctx|Call|Log|Authorization|Funding|Allowance|Erc3009|Permit2|Terms|DynString|Text)$/;

/** A tiny highlighter for Fe, TS and Solidity-ish snippets: comments, strings, numbers, keywords, types. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\/\/.*$|#.*$)|("[^"]*"|`[^`]*`)|(\b0x[0-9a-fA-F_]+\b|\b\d[\d_]*n?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    const [text, comment, str, num, word] = m;
    const key = i++;
    if (comment && (comment.startsWith("//") || /^#\s/.test(comment) || comment === "#")) {
      out.push(<span key={key} className="t-c">{text}</span>);
    } else if (comment) {
      out.push(<span key={key} className="t-a">{text}</span>);
    } else if (str) out.push(<span key={key} className="t-s">{text}</span>);
    else if (num) out.push(<span key={key} className="t-n">{text}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={key} className="t-k">{text}</span>);
    else if (word && TYPES.test(word)) out.push(<span key={key} className="t-t">{text}</span>);
    else if (word && /^[A-Z]/.test(word)) out.push(<span key={key} className="t-t">{text}</span>);
    else out.push(text);
  }
  return out;
}

/**
 * A code panel: solid ink background, wrapped lines (never a horizontal
 * scroll), optional line highlights and a copy button.
 */
export function Code({
  children,
  title,
  marks = [],
  plain = false,
}: {
  children: string;
  title?: string;
  marks?: number[];
  plain?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <figure className="codeblock">
      <figcaption>
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{title}</span>
        <button className="copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code>
          {children.split("\n").map((line, n) => (
            <span key={n} className={marks.includes(n + 1) ? "line mark" : "line"}>
              {plain ? line : highlight(line)}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
