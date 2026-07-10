/**
 * Tiny dependency-free markdown renderer for AI-authored docs (headings, bullets,
 * paragraphs, **bold**). Builds React elements — no dangerouslySetInnerHTML, so
 * model/user-authored content can never inject markup. Server-safe.
 */
import React from "react";

function inline(text: string, keyBase: string): React.ReactNode[] {
  // **bold** only — the AI prompts don't emit other inline syntax we care about.
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={`${keyBase}-${i}`}>{part}</strong> : part));
}

export function SimpleMarkdown({ md, size = 14 }: { md: string; size?: number }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let tableRows: string[][] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} style={{ margin: "6px 0 12px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 4 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: size, lineHeight: 1.55, color: "var(--ink-soft)" }}>
            {inline(b, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [head, ...body] = tableRows;
    blocks.push(
      <table key={`t-${key++}`} style={{ borderCollapse: "collapse", margin: "6px 0 12px", width: "100%" }}>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} style={{ textAlign: "left", fontSize: size - 1, padding: "6px 10px", borderBottom: "2px solid var(--border)", color: "var(--ink)" }}>
                {inline(c, `th-${key}-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (
                <td key={i} style={{ fontSize: size, padding: "6px 10px", borderBottom: "1px solid var(--border-soft)", color: "var(--ink-soft)" }}>
                  {inline(c, `td-${key}-${r}-${i}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>,
    );
    tableRows = [];
  };

  for (const rawLine of md.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushTable();
      bullets.push(bullet[1]);
      continue;
    }
    const tableRow = /^\s*\|(.+)\|\s*$/.exec(line);
    if (tableRow) {
      flushBullets();
      const cells = tableRow[1].split("|").map((c) => c.trim());
      // Skip the |---|---| separator row.
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) tableRows.push(cells);
      continue;
    }
    flushBullets();
    flushTable();
    if (!line.trim()) continue;
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <div
          key={`h-${key++}`}
          style={{
            fontWeight: 800,
            letterSpacing: "-.01em",
            fontSize: level <= 1 ? size + 6 : level === 2 ? size + 3 : size + 1,
            margin: `${blocks.length === 0 ? 0 : 18}px 0 6px`,
          }}
        >
          {inline(h[2], `h-${key}`)}
        </div>,
      );
    } else {
      blocks.push(
        <p key={`p-${key++}`} style={{ margin: "0 0 10px", fontSize: size, lineHeight: 1.6, color: "var(--ink-soft)" }}>
          {inline(line, `p-${key}`)}
        </p>,
      );
    }
  }
  flushBullets();
  flushTable();
  return <div>{blocks}</div>;
}
