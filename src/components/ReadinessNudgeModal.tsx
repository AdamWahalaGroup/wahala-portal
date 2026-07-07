"use client";

/**
 * Training nudge — not proposal-ready (frame 39). Fires when a deal is dragged to
 * Proposal out below the readiness bar. The failed checks quote the transcript
 * VERBATIM — the quotes are what make the nudge persuasive. Pipeline steps are
 * never gates: "Advance anyway" moves the deal immediately and logs an override.
 */
import { useEffect, useState } from "react";

type Check = { field: string; label: string; status: string; evidence: string | null };
type ReadinessData = { score: number; tone: string; ready: boolean; failed: Check[]; recommendation: string };

export function ReadinessNudgeModal({
  dealId,
  dealName,
  onKeep,
  onAdvance,
  onClose,
}: {
  dealId: string;
  dealName: string;
  /** Keep in Discovery — logs nudge_acted, closes. */
  onKeep: () => void;
  /** Advance anyway — the caller performs the move with override:true. */
  onAdvance: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReadinessData | null>(null);

  useEffect(() => {
    fetch(`/api/deals/${dealId}/readiness`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => setData(raw as ReadinessData | null))
      .catch(() => setData(null));
    // The nudge itself is an event — measurement and guidance are the same model.
    fetch(`/api/deals/${dealId}/readiness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "fired", metadata: { surface: "board_drag" } }),
    }).catch(() => {});
  }, [dealId]);

  async function keep() {
    await fetch(`/api/deals/${dealId}/readiness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "acted", metadata: { choice: "keep_in_discovery" } }),
    }).catch(() => {});
    onKeep();
  }

  const failed = (data?.failed ?? []).filter((f) => f.evidence).slice(0, 5);
  const failedBare = (data?.failed ?? []).filter((f) => !f.evidence).slice(0, Math.max(0, 5 - failed.length));

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 85, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "7vh 16px" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 540, overflow: "hidden" }}>
        {/* Amber header strip */}
        <div style={{ background: "#FFF7ED", borderBottom: "1px solid #FADCB4", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FCEFDC", color: "#B45309", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flex: "none" }}>
            ⚠
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.01em", color: "#92400E" }}>Hold on — this deal isn&apos;t proposal-ready</div>
            <div className="mono" style={{ fontSize: 10, color: "#B45309", marginTop: 2 }}>{dealName} → Proposal out</div>
          </div>
          <span className="mono" style={{ fontSize: 10, fontWeight: 800, background: "#FBE3E3", color: "#B91C1C", borderRadius: 999, padding: "4px 11px", flex: "none" }}>
            READINESS {data ? data.score.toFixed(1) : "…"}/10
          </span>
        </div>

        <div style={{ padding: "16px 18px" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            A proposal written on this package argues price instead of the customer&apos;s own pain — the open fields below are what it would be guessing about.
          </p>

          {/* Failed checks, evidence quoted verbatim */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 11, marginTop: 12, overflow: "hidden" }}>
            {data === null ? (
              <p className="mono" style={{ margin: 0, padding: "10px 13px", fontSize: 10.5, color: "var(--muted-line)" }}>checking the package…</p>
            ) : (
              [...failed, ...failedBare].map((f, i) => (
                <div key={f.field} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 13px", borderTop: i === 0 ? "none" : "1px solid var(--border-softer)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: "#FBE3E3", color: "#B91C1C", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flex: "none", marginTop: 1 }}>
                    ✕
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{f.label}</span>
                    {f.evidence && (
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginLeft: 8 }}>
                        &ldquo;{f.evidence}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recommendation */}
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--cobalt-wash)", border: "1px solid #DDE1FB", borderRadius: 11, padding: "11px 13px", marginTop: 12 }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--cobalt)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none", marginTop: 1 }}>
              ?
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#2536C4" }}>Recommended: stay in Discovery</div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#2536C4", lineHeight: 1.5 }}>{data?.recommendation ?? "One more call closing the open fields, then draft."}</p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={keep}
              style={{ background: "var(--cobalt)", color: "var(--white)", border: 0, borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "2 1 50%" }}
            >
              Keep in Discovery · schedule workshop
            </button>
            <button
              onClick={onAdvance}
              style={{ background: "var(--white)", color: "var(--muted)", border: "1px solid #E2E3E8", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: "1 1 30%" }}
            >
              Advance anyway
            </button>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", textAlign: "center", marginTop: 9 }}>
            stages are never gates — overrides are logged to the deal
          </div>
        </div>
      </div>
    </div>
  );
}
