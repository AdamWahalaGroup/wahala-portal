"use client";

/**
 * Training nudge for weak send evidence. Fires on SEND when solution clarity is
 * below threshold or the buying path is not confirmed. The failed checks quote
 * the transcript VERBATIM — the quotes are what make the nudge persuasive. The
 * nudge is never a gate: "Send anyway" runs the full send path and logs an override.
 * variant="advance" keeps the legacy stage-move copy for any remaining callers.
 */
import { useEffect, useState } from "react";
import { BUYING_PATH_LABELS, BUYING_PATH_PROMPTS, type BuyingPath, type BuyingPathFieldKey } from "@/domain/process";

type Check = { field: string; label: string; status: string; evidence: string | null };
type ReadinessData = { score: number; tone: string; ready: boolean; readyToDraft: boolean; readyToSend: boolean; buyingPath: BuyingPath; failed: Check[]; recommendation: string };

export function ReadinessNudgeModal({
  dealId,
  dealName,
  variant = "advance",
  onKeep,
  onAdvance,
  onClose,
}: {
  dealId: string;
  dealName: string;
  /** "send" = the proposal-editor Send intercept (09 Jul b copy); "advance" = legacy stage move. */
  variant?: "advance" | "send";
  /** Hold the send / keep in Discovery — logs nudge_acted, closes. */
  onKeep: () => void;
  /** Send anyway / advance anyway — the caller runs the send (or move) and logs the override. */
  onAdvance: () => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReadinessData | null>(null);

  const send = variant === "send";

  useEffect(() => {
    fetch(`/api/deals/${dealId}/readiness`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => setData(raw as ReadinessData | null))
      .catch(() => setData(null));
    // The nudge itself is an event — measurement and guidance are the same model.
    fetch(`/api/deals/${dealId}/readiness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "fired", metadata: { surface: send ? "proposal_send" : "board_drag" } }),
    }).catch(() => {});
  }, [dealId, send]);

  async function keep() {
    await fetch(`/api/deals/${dealId}/readiness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "acted", metadata: { choice: send ? "hold_the_send" : "keep_in_discovery" } }),
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
        <div style={{ background: "#FFF7ED", borderBottom: "1px solid #FADCB4", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "#FCEFDC", color: "#B45309", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, flex: "none" }}>
            ⚠
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.01em", color: "#92400E" }}>Hold on — check the evidence before sending</div>
            <div className="mono" style={{ fontSize: 10, color: "#B45309", marginTop: 2 }}>{dealName} → Proposal out</div>
          </div>
          <span className="mono" style={{ fontSize: 10, fontWeight: 800, background: "#FBE3E3", color: "#B91C1C", borderRadius: 999, padding: "4px 11px", flex: "none" }}>
            SOLUTION {data ? data.score.toFixed(1) : "…"}/10
          </span>
          {data && <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: data.buyingPath.status === "confirmed" ? "#DCF5E3" : "#FCEFDC", color: data.buyingPath.status === "confirmed" ? "#15803D" : "#B45309", borderRadius: 999, padding: "4px 10px", flex: "none" }}>BUYING {data.buyingPath.status.toUpperCase()}</span>}
        </div>

        <div style={{ padding: "16px 18px" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            {send
              ? "Drafting and sending are different decisions. Solution clarity protects scope and price; the buying path shows whether the customer can credibly approve and fund the work."
              : "Solution clarity protects scope and price; the buying path shows whether the customer can credibly approve and fund the work."}
          </p>

          {/* Failed checks, evidence quoted verbatim */}
          {(data === null || failed.length > 0 || failedBare.length > 0) && <div style={{ border: "1px solid var(--border)", borderRadius: 11, marginTop: 12, overflow: "hidden" }}>
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
          </div>}

          {data && data.buyingPath.missing.length > 0 && (
            <div style={{ border: "1px solid #FADCB4", background: "#FFFBF5", borderRadius: 11, marginTop: 12, padding: "10px 13px" }}>
              <div className="kicker" style={{ color: "#B45309", marginBottom: 6 }}>Open buying-path evidence</div>
              {data.buyingPath.missing.map((field) => {
                const key = field as BuyingPathFieldKey;
                return <div key={key} style={{ fontSize: 11.5, color: "var(--ink-soft)", padding: "3px 0" }}><b>{BUYING_PATH_LABELS[key]}:</b> {BUYING_PATH_PROMPTS[key]}</div>;
              })}
            </div>
          )}

          {/* Recommendation */}
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--cobalt-wash)", border: "1px solid #DDE1FB", borderRadius: 11, padding: "11px 13px", marginTop: 12 }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--cobalt)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none", marginTop: 1 }}>
              ?
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#2536C4" }}>{send ? "Recommended: hold the send." : "Recommended: stay in Discovery"}</div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#2536C4", lineHeight: 1.5 }}>
                {send
                  ? data?.recommendation ?? "Keep the draft and close the evidence gaps before sending."
                  : data?.recommendation ?? "One more call closing the open fields, then draft."}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={keep}
              style={{ background: "var(--cobalt)", color: "var(--white)", border: 0, borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "2 1 50%" }}
            >
              {send ? "Hold the send · stay in Discovery" : "Keep in Discovery · schedule workshop"}
            </button>
            <button
              onClick={onAdvance}
              style={{ background: "var(--white)", color: "var(--muted)", border: "1px solid #E2E3E8", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: "1 1 30%" }}
            >
              {send ? "Send anyway" : "Advance anyway"}
            </button>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", textAlign: "center", marginTop: 9 }}>
            {send ? "the nudge is never a gate — overrides are logged to the deal" : "stages are never gates — overrides are logged to the deal"}
          </div>
        </div>
      </div>
    </div>
  );
}
