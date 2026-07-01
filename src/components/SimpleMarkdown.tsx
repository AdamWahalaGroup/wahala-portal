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

  for (const rawLine of md.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
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
  return <div>{blocks}</div>;
}
