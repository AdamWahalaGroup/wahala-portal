"use client";

/**
 * Public sign flow (HANDOFF-DELTA-2026-07-07 §3.3): tap an option tile, type
 * your full name, Sign & approve (or Decline) → the "Signed & sealed" dark
 * takeover with the what-just-unlocked list. This moment should feel like an
 * accomplishment, not a form confirmation.
 */
import { useState } from "react";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import type { ProposalPhase, ProposalScopeDetails } from "@/domain/proposal-doc";

type PublicOption = {
  id: string;
  label: string;
  name: string;
  priceCents: number;
  priceNote: string | null;
  timelineNote: string | null;
  summaryMd: string;
  scopeDetails: ProposalScopeDetails | null;
  recommended: boolean;
  phases: ProposalPhase[] | null;
};

function PublicScope({ details }: { details: ProposalScopeDetails | null | undefined }) {
  if (!details) return null;
  const sections = [
    { label: "Objective", lines: details.objective ? [details.objective] : [] },
    { label: "Included scope", lines: details.scopeItems },
    { label: "Deliverables", lines: details.deliverables },
    { label: "Acceptance", lines: details.acceptanceCriteria },
    { label: "Not included", lines: details.exclusions },
  ].filter((section) => section.lines.length > 0);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sections.map((section) => (
        <div key={section.label}>
          <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>{section.label}</div>
          {section.lines.length === 1 ? (
            <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ink-soft)" }}>{section.lines[0]}</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5, color: "var(--ink-soft)" }}>
              {section.lines.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function PublicProposal({
  token,
  status,
  respondedByName,
  respondedAt,
  selectedOptionId,
  options,
  preview = false,
}: {
  token: string;
  status: "sent" | "approved" | "declined" | "draft" | "superseded";
  respondedByName: string | null;
  respondedAt: string | null;
  selectedOptionId: string | null;
  options: PublicOption[];
  /** Staff draft preview — everything renders, sign/decline are inert. */
  preview?: boolean;
}) {
  const recommended = options.find((o) => o.recommended);
  const [picked, setPicked] = useState<string>(selectedOptionId ?? recommended?.id ?? options[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"view" | "signed" | "declined">(status === "approved" ? "signed" : status === "declined" ? "declined" : "view");
  const [signedBy, setSignedBy] = useState(respondedByName ?? "");

  const signedOption = options.find((o) => o.id === (status === "approved" ? selectedOptionId : picked));

  async function sign() {
    if (preview || !name.trim()) return;
    setBusy("sign");
    setError(null);
    try {
      const res = await fetch(`/api/p/${token}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId: picked, name: name.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? "Something went wrong — try again.");
      else {
        setSignedBy(name.trim());
        setStep("signed");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (preview) return;
    setBusy("decline");
    setError(null);
    try {
      const res = await fetch(`/api/p/${token}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? "Something went wrong — try again.");
      else setStep("declined");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------- sealed takeover
  if (step === "signed") {
    // On-sign the first phase goes active; when rendering a freshly-signed state the
    // server data may predate that — present phase 1 as active regardless.
    const phases = signedOption?.phases ?? [];
    return (
      <section style={{ marginTop: 20, background: "var(--ink)", borderRadius: 16, padding: "30px 24px", textAlign: "center", color: "#cfd2da" }}>
        <span style={{ width: 46, height: 46, borderRadius: 999, background: "#16a34a", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
          ✓
        </span>
        <h2 style={{ margin: "14px 0 0", fontSize: 20, fontWeight: 800, color: "var(--white)", letterSpacing: "-.02em" }}>Signed &amp; sealed</h2>
        <p style={{ margin: "8px 0 0", fontSize: 13 }}>
          <b style={{ color: "var(--white)" }}>{signedBy || "You"}</b> approved{signedOption ? ` Option ${signedOption.label} — ${signedOption.name}` : " this proposal"}
        </p>
        <p className="mono" style={{ margin: "4px 0 0", fontSize: 10, color: "#8b909a" }}>
          {respondedAt ? new Date(respondedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "just now"} · master signature on file
        </p>

        <div style={{ margin: "20px auto 0", maxWidth: 360, textAlign: "left", background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "14px 16px" }}>
          <div className="kicker" style={{ color: "#6b7079", marginBottom: 9 }}>What just unlocked</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color: "#4ade80", fontWeight: 800 }}>✓</span> Your engagement moved into the contract room
            </div>
            {phases.length > 0 ? (
              phases.map((ph, i) => {
                const active = i === 0 || ph.status === "active" || ph.status === "done";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        background: ph.status === "done" ? "#16a34a" : i === 0 || ph.status === "active" ? "#2b3ee6" : "#2c2f36",
                        color: active ? "#fff" : "#8b909a",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        flex: "none",
                      }}
                    >
                      {ph.status === "done" ? "✓" : i + 1}
                    </span>
                    <span style={{ fontSize: 12.5, color: active ? "var(--white)" : "#8b909a", flex: 1, minWidth: 0 }}>{ph.name}</span>
                    <span className="mono" style={{ fontSize: 9.5, color: "#8b909a", flex: "none" }}>
                      <Money cents={ph.amountCents} /> · {i === 0 && ph.status !== "done" ? "active now" : ph.status === "done" ? "delivered" : "awaits amendment"}
                    </span>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 12.5 }}>
                <span style={{ color: "#4ade80", fontWeight: 800 }}>✓</span> One fixed-price delivery — work is cleared to schedule
              </div>
            )}
          </div>
        </div>
        <p className="mono" style={{ margin: "16px 0 0", fontSize: 9.5, color: "#595e67" }}>
          later phases are confirmed with you as the engagement reaches them — no re-signing
        </p>
      </section>
    );
  }

  if (step === "declined") {
    return (
      <section style={{ marginTop: 20, background: "#fdeeee", border: "1px solid #f0caca", borderRadius: 14, padding: "16px 20px", fontSize: 13.5, color: "#b91c1c", fontWeight: 600 }}>
        This proposal was declined. Your Wahala representative can prepare a revised version.
      </section>
    );
  }

  // ---------------------------------------------------------------- pick + sign
  return (
    <section style={{ marginTop: 20 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>{options.length === 1 ? "The proposal" : "Pick your path"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {options.map((o) => {
          const on = picked === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setPicked(o.id)}
              style={{
                textAlign: "left",
                background: on ? "#F4FBF7" : "var(--white)",
                border: on ? "2px solid #16a34a" : "1px solid var(--border)",
                borderRadius: 14,
                padding: "16px 18px",
                cursor: "pointer",
                color: "var(--ink)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: on ? "#16a34a" : "var(--ink)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flex: "none" }}>
                  {o.label}
                </span>
                <span style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: "-.015em", flex: 1, minWidth: 0 }}>{o.name}</span>
                {o.recommended && (
                  <span className="kicker" style={{ fontSize: 8.5, background: "#DCF5E3", color: "#15803D", borderRadius: 5, padding: "3px 7px", flex: "none" }}>RECOMMENDED</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
                <Money cents={o.priceCents} style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-.02em" }} />
                {o.priceNote && <span style={{ fontSize: 12, color: "var(--muted)" }}>{o.priceNote}</span>}
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 4 }}>
                {o.timelineNote && (
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-soft)", background: "var(--surface)", borderRadius: 999, padding: "3px 9px" }}>{o.timelineNote}</span>
                )}
                {o.phases && o.phases.length > 0 && (
                  <span className="mono" style={{ fontSize: 10, color: "#2536C4", background: "#EEF0FE", borderRadius: 999, padding: "3px 9px" }}>
                    {o.phases.length} phases · each confirmed with you
                  </span>
                )}
              </div>
              {o.summaryMd && (
                <div style={{ marginTop: 8 }}>
                  <SimpleMarkdown md={o.summaryMd} size={12.5} />
                </div>
              )}
              {on && (
                <div style={{ display: "grid", gap: 10, marginTop: 10, borderTop: "1px solid var(--border-softer)", paddingTop: 10 }}>
                  <PublicScope details={o.scopeDetails} />
                  {o.phases?.map((phase, index) => (
                    <div key={index} style={{ background: "var(--surface-soft)", borderRadius: 9, padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 7 }}>{index + 1}. {phase.name}</div>
                      <PublicScope details={phase.scopeDetails} />
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Type your full name to sign</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7d9df", borderRadius: 9, padding: "11px 13px", fontSize: 15, background: "var(--white)", color: "var(--ink)" }}
        />
        {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}
        <button
          onClick={sign}
          disabled={preview || !name.trim() || busy !== null}
          style={{
            width: "100%",
            marginTop: 10,
            background: name.trim() ? "#16a34a" : "#e5e7eb",
            color: name.trim() ? "#fff" : "#9aa0aa",
            border: 0,
            borderRadius: 10,
            padding: "13px 16px",
            fontSize: 14.5,
            fontWeight: 800,
            cursor: name.trim() ? "pointer" : "default",
          }}
        >
          {busy === "sign" ? "Signing…" : `Sign & approve${signedOption ? ` — Option ${signedOption.label}` : ""}`}
        </button>
        <p className="mono" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--muted-line)", textAlign: "center" }}>
          {preview ? "preview — buttons activate on the real link" : "your typed name is recorded as the master signature · no payment due at signing"}
        </p>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button
            onClick={decline}
            disabled={preview || busy !== null}
            style={{ border: 0, background: "none", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {busy === "decline" ? "…" : "Decline"}
          </button>
        </div>
      </div>
    </section>
  );
}
