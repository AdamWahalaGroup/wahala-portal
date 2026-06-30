"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Note = { id: string; author: string; body: string; createdAt: string | Date };
type Deliverable = {
  id: string;
  groupLabel: string | null;
  description: string;
  completed: boolean;
  completedAt: string | Date | null;
  notes: Note[];
};

/** Group deliverables by epic, preserving first-seen order. */
function groupByEpic(items: Deliverable[]): { label: string; items: Deliverable[] }[] {
  const groups: { label: string; items: Deliverable[] }[] = [];
  for (const d of items) {
    const label = d.groupLabel ?? "";
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(d);
  }
  return groups;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
  background: "var(--white)",
};

export function DeliverablesClient({ deliverables, canManage }: { deliverables: Deliverable[]; canManage: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const groups = groupByEpic(deliverables);

  return (
    <div>
      {groups.map((g) => {
        const done = g.items.filter((d) => d.completed).length;
        return (
          <div key={g.label || "_general"} style={{ marginBottom: g.label ? 14 : 0 }}>
            {g.label && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "8px 0 4px" }}>
                <span className="kicker" style={{ color: "var(--cobalt)" }}>
                  {g.label}
                </span>
                <span className="kicker" style={{ color: done === g.items.length ? "#15803d" : "var(--muted)" }}>
                  {done}/{g.items.length} done
                </span>
              </div>
            )}
            <div>
              {g.items.map((d) => (
                <DeliverableRow key={d.id} d={d} canManage={canManage} setError={setError} />
              ))}
            </div>
          </div>
        );
      })}
      {error && <p style={{ color: "#b00020", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

function DeliverableRow({ d, canManage, setError }: { d: Deliverable; canManage: boolean; setError: (s: string | null) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const box = {
    width: 19,
    height: 19,
    borderRadius: 6,
    flex: "none" as const,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    background: d.completed ? "#16a34a" : "var(--white)",
    color: "var(--white)",
    border: d.completed ? "none" : "1.5px solid #d7d9df",
  };
  const showExpand = d.notes.length > 0 || canManage;

  return (
    <div style={{ borderBottom: "1px solid var(--border-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0" }}>
        {canManage ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => call(`/api/deliverables/${d.id}/complete`, { completed: !d.completed })}
            title={d.completed ? "Mark not done" : "Mark complete"}
            aria-label={d.completed ? "Mark not done" : "Mark complete"}
            style={{ ...box, cursor: busy ? "default" : "pointer", padding: 0 }}
          >
            {d.completed ? "✓" : ""}
          </button>
        ) : (
          <span style={box}>{d.completed ? "✓" : ""}</span>
        )}

        <span style={{ fontSize: 14.5, flex: 1, minWidth: 0, color: d.completed ? "var(--muted)" : "var(--ink)" }}>
          {d.description}
          {d.completed && (
            <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: "#15803d", background: "#dcf5e3", borderRadius: 999, padding: "1px 7px" }}>
              Completed
            </span>
          )}
        </span>

        {showExpand && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, fontWeight: 600, flex: "none", whiteSpace: "nowrap" }}
          >
            {d.notes.length > 0 ? `${d.notes.length} note${d.notes.length === 1 ? "" : "s"}` : "Add note"} {open ? "▾" : "▸"}
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: "0 0 12px 31px" }}>
          {d.notes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: canManage ? 8 : 0 }}>
              {d.notes.map((n) => (
                <div key={n.id} style={{ fontSize: 13.5 }}>
                  <span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                    — {n.author}, {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                style={inputStyle}
                placeholder="Add a progress note (the client sees this)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && note.trim()) {
                    e.preventDefault();
                    call(`/api/deliverables/${d.id}/notes`, { body: note.trim() }).then((ok) => ok && setNote(""));
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
