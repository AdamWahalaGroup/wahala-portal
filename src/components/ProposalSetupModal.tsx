"use client";

/**
 * "Before I draft this" (HANDOFF-DELTA-2026-07-07 §4) — the one real judgment
 * call a veteran salesperson makes before drafting: how many pricing paths to
 * show the client, plus an optional weighting note. Confirming runs the hybrid
 * rough-out (deterministic shapes/prices + AI prose).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const PATHS: { value: "1" | "2" | "3"; label: string; hint: string }[] = [
  { value: "1", label: "Just the number", hint: "one recommended path — no menu" },
  { value: "2", label: "Standard vs. phased", hint: "a straight delivery and a phased one" },
  { value: "3", label: "Good-better-best", hint: "three tiers, sized up and down" },
];

export function ProposalSetupModal({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const router = useRouter();
  const [pathCount, setPathCount] = useState<"1" | "2" | "3">("2");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "rough", pathCount, note: note.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; proposalId?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
      } else if (data.proposalId) {
        router.push(`/dashboard/proposals/${data.proposalId}`);
      }
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      onClick={busy ? undefined : onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 14, padding: "22px 24px", maxWidth: 440, width: "100%", boxShadow: "var(--shadow-modal)" }}>
        <div className="kicker" style={{ marginBottom: 4 }}>◆ Rough out a draft</div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "-.02em" }}>Before I draft this</h3>
        <p style={{ margin: "6px 0 14px", fontSize: 12.5, color: "var(--muted)" }}>How many pricing paths should the client see?</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {PATHS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPathCount(p.value)}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 9,
                textAlign: "left",
                background: pathCount === p.value ? "#EEF0FE" : "var(--white)",
                color: "var(--ink)",
                border: pathCount === p.value ? "1.5px solid var(--cobalt)" : "1px solid #d7d9df",
                borderRadius: 10,
                padding: "10px 13px",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, flex: "none" }}>{p.label}</span>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)" }}>{p.hint}</span>
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything I should weight? (optional — e.g. they fear vendor lock-in)"
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, minHeight: 60, marginTop: 12, fontFamily: "inherit", background: "var(--white)", color: "var(--ink)" }}
        />

        {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}

        <div style={{ display: "flex", gap: 9, marginTop: 14, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Drafting (~20s)…" : "Draft it with AI →"}
          </button>
        </div>
      </div>
    </div>
  );
}
