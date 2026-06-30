"use client";

import { useState } from "react";
import { STATUS_STYLES } from "@/lib/theme";
import type { StageStatus } from "@/domain/stage-machine";
import { ACTION_LABELS } from "@/lib/format";

type Item = { action: string; actorName: string; from?: string; to?: string; createdAt: string | Date; note?: string };

function label(action: string): string {
  const key = action.replace(/^stage\./, "");
  return ACTION_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Who did what, when — status-colored node + connector; entries with a note expand. */
export function HistoryTimeline({ items }: { items: Item[] }) {
  if (items.length === 0) return <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No history yet.</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((it, i) => (
        <HistoryRow key={i} it={it} last={i === items.length - 1} />
      ))}
    </ul>
  );
}

function HistoryRow({ it, last }: { it: Item; last: boolean }) {
  const [open, setOpen] = useState(false);
  const dot = (it.to && STATUS_STYLES[it.to as StageStatus]?.dot) || "var(--muted-line)";
  const hasDetails = !!it.note;

  return (
    <li style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: dot, marginTop: 4, flex: "none", boxShadow: "0 0 0 3px var(--white)" }} />
        {!last && <span style={{ width: 2, flex: 1, background: "var(--border)", marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 16, flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5 }}>
          <strong>{it.actorName}</strong> {label(it.action)}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              style={{ marginLeft: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--cobalt-text)", fontSize: 11.5, fontWeight: 600 }}
            >
              {open ? "hide" : "details"}
            </button>
          )}
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
          {it.from && it.to ? `→ ${it.from} → ${it.to} · ` : ""}
          {new Date(it.createdAt).toLocaleString()}
        </div>
        {open && it.note && (
          <div style={{ marginTop: 6, background: "var(--surface)", borderLeft: "2px solid var(--border)", borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
            <div className="kicker" style={{ marginBottom: 3 }}>
              Note
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{it.note}</p>
          </div>
        )}
      </div>
    </li>
  );
}
