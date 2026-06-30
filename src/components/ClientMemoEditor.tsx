/**
 * Per-client AI memory editor (frame 12 addition). Markdown textarea + Save; backs
 * organizations.ai_context_md and is read as grounding by future AI features (the
 * AI draft flow + anything else we wire up later). Admin / Account Owner only —
 * shown read-only otherwise.
 */
"use client";

import { useState } from "react";

export function ClientMemoEditor({
  orgId,
  initial,
  canEdit,
}: {
  orgId: string;
  initial: string;
  canEdit: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const dirty = body !== saved;

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${orgId}/context`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiContextMd: body }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Save failed.");
      setSaved(body);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
      <div style={{ background: "var(--ink)", color: "var(--white)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#C9D0FB" }}>◆</span>
        <span className="mono" style={{ fontSize: 12 }}>client-memory.md</span>
        <span className="kicker" style={{ marginLeft: "auto", color: "#9aa0aa", fontSize: 10 }}>
          {canEdit ? (savedFlash ? "Saved ✓" : dirty ? "Unsaved" : "Editable") : "Read-only"}
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        readOnly={!canEdit}
        rows={Math.max(6, Math.min(20, (body.match(/\n/g)?.length ?? 0) + 3))}
        placeholder={canEdit ? "# Client memory\n\nNotes, context, ground rules…\nFuture AI features read this so they don't have to re-read the source docs each time." : "No memory saved yet."}
        className="mono"
        style={{
          width: "100%",
          padding: 12,
          fontSize: 11.5,
          border: "none",
          background: "#FBFBFC",
          outline: "none",
          resize: "vertical",
          lineHeight: 1.55,
          fontFamily: "inherit",
        }}
      />
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
          Grounds AI calls for this client (cheap + on-context).
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || busy}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--white)",
              background: dirty && !busy ? "var(--ink)" : "var(--muted-line)",
              border: "none",
              borderRadius: 8,
              cursor: dirty && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {error && (
        <div style={{ background: "#FBE3E3", color: "#991B1B", padding: "8px 12px", fontSize: 12.5, borderTop: "1px solid #F4A8A8" }}>{error}</div>
      )}
    </section>
  );
}
