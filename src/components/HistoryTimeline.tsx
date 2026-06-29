import { STATUS_STYLES } from "@/lib/theme";
import type { StageStatus } from "@/domain/stage-machine";
import { ACTION_LABELS } from "@/lib/format";

type Item = { action: string; actorName: string; from?: string; to?: string; createdAt: Date };

function label(action: string): string {
  const key = action.replace(/^stage\./, "");
  return ACTION_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Who did what, when — status-colored node + connector, actor bold + mono meta. */
export function HistoryTimeline({ items }: { items: Item[] }) {
  if (items.length === 0) return <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No history yet.</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((it, i) => {
        const dot = (it.to && STATUS_STYLES[it.to as StageStatus]?.dot) || "var(--muted-line)";
        const last = i === items.length - 1;
        return (
          <li key={i} style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: dot, marginTop: 4, flex: "none", boxShadow: "0 0 0 3px var(--white)" }} />
              {!last && <span style={{ width: 2, flex: 1, background: "var(--border)", marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 16 }}>
              <div style={{ fontSize: 13.5 }}>
                <strong>{it.actorName}</strong> {label(it.action)}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                {it.from && it.to ? `→ ${it.from} → ${it.to} · ` : ""}
                {new Date(it.createdAt).toLocaleString()}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
