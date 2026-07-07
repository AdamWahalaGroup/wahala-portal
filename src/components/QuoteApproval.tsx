"use client";

/**
 * Quote approval (frame 36) — the client's dedicated review moment for a QUOTED
 * stage, mobile-first, mirroring the acceptance screen (frame 07). Deliverables
 * render as EMPTY tiles ("what you get — the acceptance checklist later"); the
 * total is a fixed price. Approving is weighty and logged; it is NOT payment —
 * the pay-gate comes next. "Request changes" posts a note to the project thread.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Item = { id: string; description: string; groupLabel: string | null };

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

export function QuoteApproval({
  stageId,
  projectId,
  stageName,
  scope,
  items,
  totalCents,
  canApprove,
}: {
  stageId: string;
  projectId: string;
  stageName: string;
  scope: string | null;
  items: Item[];
  totalCents: number;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "approve" | "changes">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/phases/${stageId}/approve_quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        if (res.status === 409) router.refresh();
        setBusy(false);
        return;
      }
      router.push(`/dashboard/phases/${stageId}`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  async function requestChanges() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          threadKey: `project:${projectId}`,
          body: `Change request on the "${stageName}" quote:\n\n${note.trim()}`,
          waitingOn: "wahala",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      setDialog(null);
      setSent(true);
      setBusy(false);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 390, margin: "0 auto" }}>
      {/* Quoted badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#e3ecfd",
          color: "#1d4ed8",
          border: "1px solid #c3d4f7",
          borderRadius: 999,
          padding: "6px 13px",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "#2563eb" }} />
        Quoted — your approval needed
      </div>

      <h1 style={{ margin: "16px 0 4px", fontSize: 23, fontWeight: 800, letterSpacing: "-.025em" }}>{stageName}</h1>
      {scope ? (
        <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{scope}</p>
      ) : (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Review the scope and fixed price below.</p>
      )}

      {/* Deliverables, grouped by epic — empty tiles (they become the acceptance checklist) */}
      <div className="kicker" style={{ margin: "22px 0 2px" }}>What you get — the acceptance checklist later</div>
      <div>
        {groupItems(items).map((g) => (
          <div key={g.label || "_general"} style={{ marginBottom: g.label ? 12 : 0 }}>
            {g.label && (
              <div className="kicker" style={{ color: "var(--cobalt)", margin: "10px 0 2px" }}>
                {g.label}
              </div>
            )}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {g.items.map((li) => (
                <li key={li.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--border-soft)" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, flex: "none", border: "1.5px solid #d7d9df", background: "var(--white)" }} />
                  <span style={{ fontSize: 15, flex: 1, minWidth: 0 }}>{li.description}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Fixed-price total */}
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
        <span style={{ fontSize: 13.5, color: "var(--muted)", fontWeight: 600 }}>Phase total · fixed price</span>
        <span className="tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {canApprove && (
          <button
            type="button"
            onClick={() => setDialog("approve")}
            disabled={busy}
            style={{ border: "none", borderRadius: 11, padding: "15px 16px", fontSize: 16, fontWeight: 700, background: "var(--ink)", color: "var(--white)", cursor: busy ? "default" : "pointer" }}
          >
            Approve quote →
          </button>
        )}
        <button
          type="button"
          onClick={() => setDialog("changes")}
          disabled={busy}
          style={{ borderRadius: 11, padding: "14px 16px", fontSize: 15, fontWeight: 600, background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", cursor: busy ? "default" : "pointer" }}
        >
          Request changes
        </button>
      </div>
      <p style={{ textAlign: "center", margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Approval is logged. You&apos;ll be asked to pay before work begins.
      </p>
      {sent && <p style={{ color: "#15803d", fontSize: 13.5, fontWeight: 600, textAlign: "center", marginTop: 10 }}>Change request sent — your Wahala team will follow up. ✓</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13.5, textAlign: "center", marginTop: 10 }}>{error}</p>}

      {/* Confirm dialog */}
      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setDialog(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-modal)" }}>
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                background: dialog === "approve" ? "var(--ink)" : "var(--surface)",
                color: dialog === "approve" ? "var(--white)" : "var(--ink)",
              }}
            >
              {dialog === "approve" ? "✓" : "✎"}
            </span>
            <h3 style={{ margin: "12px 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>
              {dialog === "approve" ? "Approve this quote?" : "Request changes?"}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
              {dialog === "approve"
                ? `This approves "${stageName}" at the fixed price of ${formatCents(totalCents)}. It's logged against your name, and you'll be asked to pay before work begins.`
                : "Tell your Wahala team what you'd like changed — it lands on the project thread and pauses nothing."}
            </p>
            {dialog === "changes" && (
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What would you like changed?"
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
                onClick={() => (dialog === "approve" ? approve() : requestChanges())}
                disabled={busy || (dialog === "changes" && !note.trim())}
                style={{
                  borderRadius: 9,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "none",
                  color: "var(--white)",
                  background: "var(--ink)",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {busy ? "Working…" : dialog === "approve" ? "Yes, approve" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
