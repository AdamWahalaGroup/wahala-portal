"use client";

/**
 * Proposal editor (HANDOFF-DELTA-2026-07-07) — the phased sign-off system.
 * Left: dark phase spine (master signature → phases of the chosen/recommended
 * option → approvers). Right: exec summary, N option cards (inline-editable,
 * admin-set "recommended"), send/contract/delete actions. Draft fields autosave
 * (~600ms debounce); everything locks the moment it's sent. Prices are typed by
 * a human — the AI never prices.
 *
 * §3 bug guard: draft inputs and locked text are gated on OPPOSITE booleans
 * (isDraft / isLocked), never the same boolean twice. §6: every interactive
 * element sets explicit color + background.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Money } from "@/components/Money";
import { ProposalStatusPill } from "@/components/SalesChips";
import { canAmendPhase } from "@/domain/proposal-math";
import type { Approver, ProposalContract, ProposalPhase } from "@/domain/proposal-doc";

type Option = {
  id: string;
  label: string;
  name: string;
  summaryMd: string;
  timelineNote: string | null;
  priceCents: number;
  priceNote: string | null;
  phases: ProposalPhase[] | null;
  recommended: boolean;
};

type Proposal = {
  id: string;
  dealId: string;
  dealName: string;
  organizationName: string;
  version: number;
  status: "draft" | "sent" | "approved" | "declined" | "superseded";
  executiveSummaryMd: string | null;
  complexityScore: number | null;
  complexityRationale: string | null;
  shareToken: string | null;
  respondedByName: string | null;
  respondedAt: Date | string | null;
  selectedOptionId: string | null;
  approvers: Approver[] | null;
  contract: ProposalContract | null;
  options: Option[];
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--white)",
  color: "var(--ink)",
  boxSizing: "border-box",
};
const btn = (tone: "ink" | "green" | "plain" | "cobalt", disabled = false): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : tone === "cobalt" ? "var(--cobalt)" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 9,
  padding: "9px 15px",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

const fmtWhen = (v: Date | string | null) =>
  v ? new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

function useDebounced<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  return (...args: A) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => fnRef.current(...args), ms);
  };
}

export function ProposalEditor({ proposal, canManage }: { proposal: Proposal; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amendConfirmIndex, setAmendConfirmIndex] = useState<number | null>(null);
  const [respond, setRespond] = useState({ outcome: "", optionId: "", name: "", note: "" });

  const isDraft = proposal.status === "draft" && canManage;
  const isLocked = !isDraft;

  // Local editable copies (draft only) — source of truth while typing; autosaved.
  const [summary, setSummary] = useState(proposal.executiveSummaryMd ?? "");
  const [opts, setOpts] = useState(
    proposal.options.map((o) => ({
      ...o,
      priceDollars: o.priceCents > 0 ? String(o.priceCents / 100) : "",
      phases: o.phases ? o.phases.map((p) => ({ ...p, amountDollars: p.amountCents > 0 ? String(p.amountCents / 100) : "" })) : null,
    })),
  );

  const chosen =
    proposal.options.find((o) => o.id === proposal.selectedOptionId) ??
    proposal.options.find((o) => o.recommended) ??
    proposal.options[0];
  const spinePhases = chosen?.phases ?? null;
  const canAmend = proposal.status === "approved" && canManage && !!proposal.selectedOptionId && !!chosen?.phases?.length;
  const complexity = proposal.complexityScore ?? 1;
  const shareUrl = proposal.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${proposal.shareToken}` : null;

  async function api(path: string, method: string, body?: unknown): Promise<boolean> {
    try {
      const res = await fetch(path, {
        method,
        headers: body !== undefined ? { "content-type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        return false;
      }
      setError(null);
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveSummary = useDebounced((text: string) => {
    void api(`/api/proposals/${proposal.id}`, "PATCH", { executiveSummaryMd: text }).then((ok) => ok && flashSaved());
  }, 600);

  const saveOption = useDebounced((optionId: string) => {
    const o = opts.find((x) => x.id === optionId);
    if (!o) return;
    void api(`/api/proposals/${proposal.id}/options/${optionId}`, "PATCH", {
      name: o.name,
      timelineNote: o.timelineNote ?? "",
      priceCents: o.priceDollars ? Math.round(parseFloat(o.priceDollars) * 100) || 0 : 0,
      phases: o.phases ? o.phases.map((p) => ({ name: p.name, amountCents: p.amountDollars ? Math.round(parseFloat(p.amountDollars) * 100) || 0 : 0, weeks: p.weeks })) : null,
    }).then((ok) => ok && flashSaved());
  }, 600);

  function patchOpt(optionId: string, patch: Partial<(typeof opts)[number]>) {
    setOpts((v) => v.map((o) => (o.id === optionId ? { ...o, ...patch } : o)));
    saveOption(optionId);
  }

  async function structural(fn: () => Promise<boolean>, key: string) {
    setBusy(key);
    const ok = await fn();
    setBusy(null);
    if (ok) router.refresh();
    return ok;
  }

  // ---------------------------------------------------------------- spine

  const sigDot =
    proposal.status === "approved"
      ? { bg: "#16a34a", icon: "✓", note: "DocuSign · sealed" }
      : proposal.status === "sent"
        ? { bg: "#2b3ee6", icon: "…", note: "awaiting signature" }
        : proposal.status === "declined"
          ? { bg: "#b91c1c", icon: "✕", note: "declined" }
          : { bg: "#3a3f47", icon: "·", note: "Not yet sent" };

  const spine = (
    <aside style={{ background: "var(--ink)", borderRadius: 14, padding: "16px 14px", color: "#cfd2da", alignSelf: "start", position: "sticky", top: 20 }}>
      <div className="kicker" style={{ color: "#6b7079", marginBottom: 10 }}>Sign-off spine</div>
      {/* Master signature */}
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", paddingBottom: 12, borderBottom: "1px solid #2c2f36" }}>
        <span style={{ width: 20, height: 20, borderRadius: 999, background: sigDot.bg, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "none" }}>
          {sigDot.icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--white)" }}>Master signature</div>
          <div className="mono" style={{ fontSize: 9.5, color: "#8b909a", marginTop: 2 }}>{sigDot.note}</div>
          {proposal.respondedByName && proposal.status === "approved" && (
            <div className="mono" style={{ fontSize: 9.5, color: "#8b909a" }}>{proposal.respondedByName} · {fmtWhen(proposal.respondedAt)}</div>
          )}
        </div>
      </div>

      {/* Phase rows of the chosen/recommended option */}
      {spinePhases && spinePhases.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 0", borderBottom: "1px solid #2c2f36" }}>
          {spinePhases.map((ph, i) => {
            const dot = ph.status === "done" ? { bg: "#16a34a", icon: "✓" } : ph.status === "active" ? { bg: "#2b3ee6", icon: String(i + 1) } : { bg: "#2c2f36", icon: String(i + 1) };
            const note = ph.status === "done" ? "delivered" : ph.status === "active" ? "active now" : "awaits amendment";
            return (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: dot.bg, color: ph.status === "awaiting_amendment" ? "#8b909a" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none" }}>
                  {dot.icon}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ph.status === "awaiting_amendment" ? "#aeb2bb" : "var(--white)", lineHeight: 1.3 }}>{ph.name}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: "#8b909a", marginTop: 1 }}>
                    <Money cents={ph.amountCents} /> · {ph.weeks}w · {note}
                  </div>
                  {canAmend && canAmendPhase(spinePhases, i) && amendConfirmIndex !== i && (
                    <button
                      onClick={() => setAmendConfirmIndex(i)}
                      style={{ border: 0, background: "none", color: "#4ade80", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 3 }}
                    >
                      Activate &amp; amend →
                    </button>
                  )}
                  {canAmend && amendConfirmIndex === i && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => setAmendConfirmIndex(null)}
                        style={{ border: "1px solid #3a3f47", background: "transparent", color: "#aeb2bb", borderRadius: 6, padding: "3px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() =>
                          void structural(async () => {
                            const ok = await api(`/api/proposals/${proposal.id}/amend`, "POST", { phaseIndex: i });
                            if (ok) setAmendConfirmIndex(null);
                            return ok;
                          }, "amend")
                        }
                        disabled={busy === "amend"}
                        style={{ border: 0, background: "#16a34a", color: "#fff", borderRadius: 6, padding: "3px 10px", fontSize: 10.5, fontWeight: 800, cursor: "pointer" }}
                      >
                        {busy === "amend" ? "…" : "Confirm"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="mono" style={{ fontSize: 9, color: "#595e67" }}>phases confirm in-app — no new signature</div>
        </div>
      ) : (
        <div className="mono" style={{ fontSize: 10, color: "#8b909a", padding: "12px 0", borderBottom: "1px solid #2c2f36" }}>
          {chosen ? "single delivery — no phases" : "no options yet"}
        </div>
      )}

      {/* Approvers */}
      <div style={{ paddingTop: 12 }}>
        <div className="kicker" style={{ color: "#6b7079", marginBottom: 7 }}>Eligible approvers</div>
        {(proposal.approvers ?? []).length === 0 ? (
          <div className="mono" style={{ fontSize: 10, color: "#8b909a" }}>none captured</div>
        ) : (
          (proposal.approvers ?? []).map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: "#2c2f36", color: "#cfd2da", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flex: "none" }}>
                {a.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--white)" }}>{a.name}</div>
                {a.role && <div className="mono" style={{ fontSize: 9, color: "#8b909a" }}>{a.role}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );

  // ---------------------------------------------------------------- main

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "start" }}>
      {spine}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {proposal.organizationName} · v{proposal.version}
          </span>
          <ProposalStatusPill status={proposal.status} />
          <span
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "3px 9px",
              borderRadius: 999,
              background: complexity > 3 ? "#FFF7ED" : "#EEF0FE",
              color: complexity > 3 ? "#B45309" : "#2536C4",
            }}
          >
            ◆ C{complexity}/5{complexity <= 3 ? " · fast-track" : ""}
          </span>
          {saved && <span className="mono" style={{ fontSize: 10, color: "#15803d", marginLeft: "auto" }}>saved ✓</span>}
        </div>

        {/* Complexity dots (draft only) */}
        {isDraft && (
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span className="kicker">Complexity</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => void structural(() => api(`/api/proposals/${proposal.id}`, "PATCH", { complexityScore: n }), "complexity")}
                title={`C${n}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "1.5px solid " + (n <= complexity ? (complexity > 3 ? "#B45309" : "#2536C4") : "#d7d9df"),
                  background: n <= complexity ? (complexity > 3 ? "#B45309" : "#2536C4") : "var(--white)",
                  color: "var(--white)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
            <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>&gt;3 routes to engineering review</span>
          </div>
        )}

        {/* Needs-review card */}
        {complexity > 3 && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FADCB4", borderLeft: "4px solid #D97706", borderRadius: 10, padding: "10px 13px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#B45309" }}>⚠ Needs engineering review</div>
            {proposal.complexityRationale && <div style={{ fontSize: 12, color: "#B45309", marginTop: 3 }}>{proposal.complexityRationale}</div>}
          </div>
        )}

        {/* Response banners */}
        {proposal.status === "approved" && (
          <div style={{ background: "#DCF5E3", border: "1px solid #BFE6CC", borderRadius: 10, padding: "10px 13px", fontSize: 13, fontWeight: 700, color: "#15803D" }}>
            ✓ Approved by {proposal.respondedByName ?? "the client"} · {fmtWhen(proposal.respondedAt)} — master signature on file
          </div>
        )}
        {proposal.status === "declined" && (
          <div style={{ background: "#FBE3E3", border: "1px solid #F4CFCF", borderRadius: 10, padding: "10px 13px", fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>
            Declined{proposal.respondedByName ? ` by ${proposal.respondedByName}` : ""} · {fmtWhen(proposal.respondedAt)}
          </div>
        )}

        {/* Executive summary — textarea while draft, static once locked (opposite booleans) */}
        <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Executive summary</div>
          {isDraft && (
            <textarea
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                saveSummary(e.target.value);
              }}
              placeholder="What their problem is and what this engagement does about it — real client-facing prose."
              style={{ ...inputStyle, width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          )}
          {isLocked && (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              {proposal.executiveSummaryMd || <span style={{ color: "var(--muted-line)" }}>No summary written.</span>}
            </p>
          )}
        </section>

        {/* Share link */}
        {shareUrl && proposal.status !== "declined" && (
          <div style={{ border: "1.5px dashed #C9D0FB", background: "#FAFBFF", borderRadius: 10, padding: "10px 13px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="kicker" style={{ flex: "none" }}>Share link</span>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11.5, color: "var(--cobalt-text)", wordBreak: "break-all" }}>
              {shareUrl}
            </a>
          </div>
        )}

        {/* Record response (sent only) — heard outside the app */}
        {proposal.status === "sent" && canManage && (
          <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Record their response (heard outside the app)</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <select value={respond.outcome} onChange={(e) => setRespond((v) => ({ ...v, outcome: e.target.value }))} style={{ ...inputStyle, width: 130 }}>
                <option value="">outcome…</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
              {respond.outcome === "approved" && (
                <select value={respond.optionId} onChange={(e) => setRespond((v) => ({ ...v, optionId: e.target.value }))} style={{ ...inputStyle, width: 150 }}>
                  <option value="">which option…</option>
                  {proposal.options.map((o) => (
                    <option key={o.id} value={o.id}>Option {o.label} — {o.name}</option>
                  ))}
                </select>
              )}
              <input placeholder="Who said it (name)" value={respond.name} onChange={(e) => setRespond((v) => ({ ...v, name: e.target.value }))} style={{ ...inputStyle, flex: "1 1 150px" }} />
              <input placeholder="Note (optional)" value={respond.note} onChange={(e) => setRespond((v) => ({ ...v, note: e.target.value }))} style={{ ...inputStyle, flex: "2 1 180px" }} />
              <button
                onClick={() =>
                  void structural(
                    () =>
                      api(`/api/proposals/${proposal.id}/respond`, "POST", {
                        outcome: respond.outcome,
                        optionId: respond.optionId || undefined,
                        respondedByName: respond.name || undefined,
                        responseNote: respond.note || undefined,
                      }),
                    "respond",
                  )
                }
                disabled={busy === "respond" || !respond.outcome || (respond.outcome === "approved" && !respond.optionId)}
                style={btn("ink", busy === "respond" || !respond.outcome)}
              >
                {busy === "respond" ? "Recording…" : "Record"}
              </button>
            </div>
          </section>
        )}

        {/* Option cards */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
          {opts.map((o) => (
            <div
              key={o.id}
              style={{
                background: "var(--white)",
                border: o.id === proposal.selectedOptionId ? "2px solid #16a34a" : o.recommended ? "2px solid #2536C4" : "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--ink)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flex: "none" }}>
                  {o.label}
                </span>
                {isDraft && (
                  <input value={o.name} onChange={(e) => patchOpt(o.id, { name: e.target.value })} placeholder="Option name" style={{ ...inputStyle, flex: 1, fontWeight: 700 }} />
                )}
                {isLocked && <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1, minWidth: 0 }}>{o.name}</span>}
                {o.id === proposal.selectedOptionId && (
                  <span className="kicker" style={{ fontSize: 9, background: "#DCF5E3", color: "#15803D", borderRadius: 5, padding: "3px 7px", flex: "none" }}>SIGNED</span>
                )}
                {isDraft && opts.length > 1 && (
                  <button
                    onClick={() => void structural(() => api(`/api/proposals/${proposal.id}/options/${o.id}`, "DELETE"), `rm-${o.id}`)}
                    title="Remove option"
                    style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 15, cursor: "pointer", padding: 0, flex: "none" }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Recommended toggle — admin-chosen, toggle OFF is valid */}
              <div>
                {o.recommended ? (
                  <button
                    onClick={() => (isDraft ? void structural(() => api(`/api/proposals/${proposal.id}/options/${o.id}`, "PATCH", { toggleRecommended: true }), "rec") : undefined)}
                    title={isDraft ? "Click to un-mark" : undefined}
                    style={{ border: 0, background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "3px 10px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", cursor: isDraft ? "pointer" : "default" }}
                  >
                    RECOMMENDED
                  </button>
                ) : isDraft ? (
                  <button
                    onClick={() => void structural(() => api(`/api/proposals/${proposal.id}/options/${o.id}`, "PATCH", { toggleRecommended: true }), "rec")}
                    style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    Mark recommended
                  </button>
                ) : null}
              </div>

              {/* Price + timeline */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {isDraft && (
                  <>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>$</span>
                    <input
                      value={o.priceDollars}
                      onChange={(e) => patchOpt(o.id, { priceDollars: e.target.value.replace(/[^0-9.]/g, "") })}
                      placeholder="0"
                      inputMode="numeric"
                      style={{ ...inputStyle, width: 110, fontWeight: 800 }}
                    />
                    <input
                      value={o.timelineNote ?? ""}
                      onChange={(e) => patchOpt(o.id, { timelineNote: e.target.value })}
                      placeholder="timeline note"
                      style={{ ...inputStyle, flex: "1 1 130px" }}
                    />
                  </>
                )}
                {isLocked && (
                  <>
                    <Money cents={o.priceCents} style={{ fontWeight: 800, fontSize: 17 }} />
                    {o.timelineNote && <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{o.timelineNote}</span>}
                  </>
                )}
              </div>

              {/* Phases */}
              {o.phases !== null && (
                <div style={{ borderTop: "1px solid var(--border-softer)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="kicker" style={{ fontSize: 9.5 }}>Phases</div>
                  {o.phases.map((ph, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {isDraft && (
                        <>
                          <input
                            value={ph.name}
                            onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)) })}
                            style={{ ...inputStyle, flex: 2, fontSize: 12 }}
                          />
                          <input
                            value={ph.amountDollars}
                            onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, amountDollars: e.target.value.replace(/[^0-9.]/g, "") } : p)) })}
                            placeholder="$"
                            inputMode="numeric"
                            style={{ ...inputStyle, width: 84, fontSize: 12 }}
                          />
                          <input
                            value={String(ph.weeks)}
                            onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, weeks: Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0) } : p)) })}
                            title="weeks"
                            inputMode="numeric"
                            style={{ ...inputStyle, width: 46, fontSize: 12 }}
                          />
                          <button
                            onClick={() => patchOpt(o.id, { phases: o.phases!.filter((_, j) => j !== i) })}
                            title="Remove phase"
                            style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 13, cursor: "pointer", padding: 0 }}
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {isLocked && (
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                          {ph.name} · <Money cents={ph.amountCents} /> · {ph.weeks}w
                          {o.id === proposal.selectedOptionId && (
                            <span style={{ color: ph.status === "active" ? "#2536C4" : ph.status === "done" ? "#15803D" : "var(--muted-line)" }}>
                              {" "}· {ph.status === "done" ? "delivered" : ph.status === "active" ? "active" : "awaits amendment"}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                  {isDraft && (
                    <button
                      onClick={() => patchOpt(o.id, { phases: [...o.phases!, { name: `Phase ${o.phases!.length + 1}`, amountCents: 0, amountDollars: "", weeks: 2, status: "awaiting_amendment" as const }] })}
                      style={{ alignSelf: "flex-start", border: "1px dashed #d7d9df", background: "var(--white)", color: "var(--ink-soft)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      + Add phase
                    </button>
                  )}
                </div>
              )}
              {isLocked && o.summaryMd && <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{o.summaryMd}</p>}
            </div>
          ))}
          {isDraft && opts.length < 8 && (
            <button
              onClick={() =>
                void structural(() => api(`/api/proposals/${proposal.id}/options`, "POST"), "add-option")
              }
              disabled={busy === "add-option"}
              style={{ border: "1.5px dashed #C9D0FB", background: "#FAFBFF", color: "var(--cobalt-text)", borderRadius: 12, padding: 18, fontSize: 13.5, fontWeight: 700, cursor: "pointer", minHeight: 90 }}
            >
              + Add option
            </button>
          )}
        </section>

        {error && <p style={{ color: "#b00020", fontSize: 13, margin: 0 }}>{error}</p>}

        {/* Action row */}
        {canManage && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {isDraft && (
              <button onClick={() => setConfirmSend(true)} disabled={busy === "send"} style={btn("ink", busy === "send")}>
                Send to client →
              </button>
            )}
            {(proposal.status === "approved" || proposal.status === "sent" || proposal.contract) &&
              (proposal.contract ? (
                <Link href={`/dashboard/proposals/${proposal.id}/contract`} style={{ ...btn("cobalt"), textDecoration: "none", display: "inline-block" }}>
                  View contract / SOW →
                </Link>
              ) : (
                <button
                  onClick={() =>
                    void (async () => {
                      setBusy("contract");
                      const ok = await api(`/api/proposals/${proposal.id}/contract`, "POST");
                      setBusy(null);
                      if (ok) router.push(`/dashboard/proposals/${proposal.id}/contract`);
                    })()
                  }
                  disabled={busy === "contract"}
                  style={btn("cobalt", busy === "contract")}
                >
                  {busy === "contract" ? "Generating…" : "◆ Generate contract / SOW"}
                </button>
              ))}
            {(proposal.status === "draft" || proposal.status === "sent") && (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ marginLeft: "auto", border: 0, background: "none", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                Delete proposal
              </button>
            )}
          </div>
        )}

        {/* Send confirm */}
        {confirmSend && (
          <div onClick={() => setConfirmSend(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 14, padding: "22px 24px", maxWidth: 420, width: "100%", boxShadow: "var(--shadow-modal)" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Send to the client?</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                {complexity > 3
                  ? "Complexity is above 3 — engineering review is recommended before this goes out. Sending anyway is allowed and logged."
                  : "This generates the public share link and locks the draft."}
              </p>
              <div style={{ display: "flex", gap: 9, marginTop: 16, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmSend(false)} style={btn("plain")}>Cancel</button>
                <button
                  onClick={() =>
                    void structural(async () => {
                      const ok = await api(`/api/proposals/${proposal.id}/send`, "POST");
                      if (ok) setConfirmSend(false);
                      return ok;
                    }, "send")
                  }
                  disabled={busy === "send"}
                  style={btn(complexity > 3 ? "plain" : "ink", busy === "send")}
                >
                  {busy === "send" ? "Sending…" : complexity > 3 ? "Send anyway" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {confirmDelete && (
          <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 14, padding: "22px 24px", maxWidth: 400, width: "100%", boxShadow: "var(--shadow-modal)" }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Delete this proposal?</h3>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>This can&apos;t be undone.</p>
              <div style={{ display: "flex", gap: 9, marginTop: 16, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmDelete(false)} style={btn("plain")}>Cancel</button>
                <button
                  onClick={() =>
                    void (async () => {
                      setBusy("delete");
                      const ok = await api(`/api/proposals/${proposal.id}`, "DELETE");
                      setBusy(null);
                      if (ok) router.push("/dashboard/proposals");
                    })()
                  }
                  disabled={busy === "delete"}
                  style={{ ...btn("ink", busy === "delete"), background: "#B91C1C" }}
                >
                  {busy === "delete" ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
