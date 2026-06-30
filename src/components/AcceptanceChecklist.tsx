"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Item = { id: string; description: string; estimateNote: string | null; amountCents: number; groupLabel: string | null };

/** Group deliverables by epic label, preserving first-seen order. */
function groupItems(items: Item[]): { label: string; items: Item[] }[] {
  const groups: { label: string; items: Item[] }[] = [];
  for (const li of items) {
    const label = li.groupLabel ?? "";
    let g = groups.find((x) => x.label === label);
    if (!g) {
      g = { label, items: [] };
      groups.push(g);
    }
    g.items.push(li);
  }
  return groups;
}

/** Mobile acceptance (design frame 07): formally accept a delivered stage, or
 *  request a revision with a note. Both are logged via the stage action endpoints. */
export function AcceptanceChecklist({
  stageId,
  stageName,
  items,
  totalCents,
  canAccept,
  canRequestRevision,
}: {
  stageId: string;
  stageName: string;
  items: Item[];
  totalCents: number;
  canAccept: boolean;
  canRequestRevision: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "accept" | "revision">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "request_revision") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stages/${stageId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "request_revision" ? { note: note.trim() } : {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        if (res.status === 409) router.refresh();
        setBusy(false);
        return;
      }
      router.push(`/dashboard/stages/${stageId}`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 390, margin: "0 auto" }}>
      {/* Delivered badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#dcf3f0",
          color: "#0f766e",
          border: "1px solid #b8e0d9",
          borderRadius: 999,
          padding: "6px 13px",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "#0d9488" }} />
        Delivered — your acceptance needed
      </div>

      <h1 style={{ margin: "16px 0 4px", fontSize: 23, fontWeight: 800, letterSpacing: "-.025em" }}>{stageName}</h1>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
        Review what was delivered against the scope you agreed to.
      </p>

      {/* Checklist, grouped by epic */}
      <div style={{ margin: "22px 0 0" }}>
        {groupItems(items).map((g) => (
          <div key={g.label || "_general"} style={{ marginBottom: g.label ? 12 : 0 }}>
            {g.label && (
              <div className="kicker" style={{ color: "var(--cobalt)", margin: "10px 0 2px" }}>
                {g.label}
              </div>
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {g.items.map((li) => (
                <li
                  key={li.id}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--border-soft)" }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 7,
                      flex: "none",
                      background: "#16a34a",
                      color: "var(--white)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    ✓
                  </span>
                  <span style={{ fontSize: 15, flex: 1, minWidth: 0 }}>
                    {li.description}
                    {li.estimateNote && <span style={{ color: "var(--muted)", fontSize: 13 }}> · {li.estimateNote}</span>}
                  </span>
                  {li.amountCents > 0 && (
                    <span className="tabular" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-soft)" }}>
                      {formatCents(li.amountCents)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Paid total */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          background: "var(--surface)",
          borderRadius: 12,
          padding: "14px 16px",
        }}
      >
        <span style={{ fontSize: 13.5, color: "var(--muted)", fontWeight: 600 }}>Paid in full</span>
        <span className="tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {canAccept && (
          <button
            type="button"
            onClick={() => setDialog("accept")}
            disabled={busy}
            style={{ border: "none", borderRadius: 11, padding: "15px 16px", fontSize: 16, fontWeight: 700, background: "#16a34a", color: "var(--white)", cursor: busy ? "default" : "pointer" }}
          >
            Accept delivery
          </button>
        )}
        {canRequestRevision && (
          <button
            type="button"
            onClick={() => setDialog("revision")}
            disabled={busy}
            style={{ borderRadius: 11, padding: "14px 16px", fontSize: 15, fontWeight: 600, background: "var(--white)", color: "#b91c1c", border: "1px solid #f0caca", cursor: busy ? "default" : "pointer" }}
          >
            Request revision
          </button>
        )}
      </div>
      <p style={{ textAlign: "center", margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Acceptance is final &amp; recorded.
      </p>
      {error && <p style={{ color: "#b00020", fontSize: 13.5, textAlign: "center", marginTop: 10 }}>{error}</p>}

      {/* Confirm dialog */}
      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setDialog(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-modal)" }}
          >
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                background: dialog === "accept" ? "#16a34a" : "#fbe3e3",
                color: dialog === "accept" ? "var(--white)" : "#b91c1c",
              }}
            >
              {dialog === "accept" ? "✓" : "↺"}
            </span>
            <h3 style={{ margin: "12px 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>
              {dialog === "accept" ? "Accept this delivery?" : "Request a revision?"}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
              {dialog === "accept"
                ? `This records all ${items.length} item${items.length === 1 ? "" : "s"} as accepted by you today and unlocks the next stage. It can't be undone.`
                : "Tell your Wahala team what needs to change. Work resumes once it's revised."}
            </p>
            {dialog === "revision" && (
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What needs changing?"
                style={{ width: "100%", marginTop: 12, minHeight: 84, padding: "10px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 10, boxSizing: "border-box", fontFamily: "inherit" }}
              />
            )}
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={busy}
                style={{ borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 600, background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", cursor: busy ? "default" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(dialog === "accept" ? "accept" : "request_revision")}
                disabled={busy}
                style={{
                  borderRadius: 9,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  color: "var(--white)",
                  background: dialog === "accept" ? "#16a34a" : "#b91c1c",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Working…" : dialog === "accept" ? "Yes, accept" : "Request revision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
