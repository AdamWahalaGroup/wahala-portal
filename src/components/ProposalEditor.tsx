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
import { ReadinessNudgeModal } from "@/components/ReadinessNudgeModal";
import { ProposalViewSwitcher } from "@/components/ProposalViewSwitcher";
import { ExpandCollapseButton } from "@/components/ExpandCollapseButton";
import { canAmendPhase } from "@/domain/proposal-math";
import { proposalReadinessFrom } from "@/domain/process";
import type { BuyingPathStatus } from "@/domain/process";
import type { Approver, ProposalContract, ProposalCoverageReview, ProposalPhase, ProposalScopeDetails } from "@/domain/proposal-doc";

type Option = {
  id: string;
  label: string;
  name: string;
  summaryMd: string;
  scopeDetails: ProposalScopeDetails | null;
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
  /** Send is the advance; solution-clarity and buying-path coaching fires here. */
  dealStage: string | null;
  dealReadiness: number | null;
  dealBuyingPathStatus: BuyingPathStatus;
  organizationId: string | null;
  organizationName: string;
  version: number;
  status: "draft" | "sent" | "approved" | "declined" | "superseded";
  executiveSummaryMd: string | null;
  coverage: ProposalCoverageReview | null;
  complexityScore: number | null;
  complexityRationale: string | null;
  shareToken: string | null;
  respondedByName: string | null;
  respondedAt: Date | string | null;
  selectedOptionId: string | null;
  approvers: Approver[] | null;
  contract: ProposalContract | null;
  draftNeedsRefresh: boolean;
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

type ScopeListKey = Exclude<keyof ProposalScopeDetails, "objective">;

function ScopeItemCards({ label, items, placeholder, onChange }: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span className="kicker" style={{ fontSize: 8.5 }}>{label}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((item, index) => (
          <div key={index} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0, border: "1px solid #d7d9df", borderRadius: 9, background: "var(--white)", padding: "3px 5px 3px 9px" }}>
            <input
              value={item}
              onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? event.target.value : current))}
              onBlur={() => {
                if (!item.trim()) onChange(items.filter((_, itemIndex) => itemIndex !== index));
              }}
              placeholder={placeholder}
              style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "var(--ink)", fontSize: 12, lineHeight: 1.35, padding: "5px 0" }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
              title={`Remove ${label.toLowerCase()} item`}
              aria-label={`Remove ${label.toLowerCase()} item`}
              style={{ width: 24, height: 24, flex: "none", border: 0, borderRadius: 7, background: "var(--surface-soft)", color: "var(--muted)", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        style={{ alignSelf: "flex-start", border: "1px dashed #C9D0FB", borderRadius: 999, background: "#FAFBFF", color: "var(--cobalt-text)", padding: "4px 9px", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
      >
        + Add {label.toLowerCase()}
      </button>
    </div>
  );
}

function ScopeDetailsEditor({ details, onChange, compact = false, includeExclusions = true }: {
  details: ProposalScopeDetails;
  onChange: (key: keyof ProposalScopeDetails, value: string | string[]) => void;
  compact?: boolean;
  includeExclusions?: boolean;
}) {
  const rows: { key: ScopeListKey; label: string; placeholder: string }[] = [
    { key: "scopeItems", label: "Included scope", placeholder: "Included capability" },
    { key: "deliverables", label: "Deliverables", placeholder: "Tangible output" },
    { key: "acceptanceCriteria", label: "Acceptance", placeholder: "Testable acceptance condition" },
    { key: "exclusions", label: "Not included", placeholder: "Excluded or deferred capability" },
  ];
  const visibleRows = rows.filter((row) => includeExclusions || row.key !== "exclusions");
  return (
    <div style={{ display: "grid", gap: 9 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="kicker" style={{ fontSize: 8.5 }}>Outcome</span>
        <textarea
          value={details.objective}
          onChange={(event) => onChange("objective", event.target.value)}
          placeholder="Client outcome this delivery creates"
          style={{ ...inputStyle, minHeight: compact ? 58 : 68, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 9 }}>
        {visibleRows.map((row) => (
          <ScopeItemCards
            key={row.key}
            label={row.label}
            items={details[row.key]}
            placeholder={row.placeholder}
            onChange={(items) => onChange(row.key, items)}
          />
        ))}
      </div>
    </div>
  );
}

function ScopeDetailsRead({ details, mode = "all" }: {
  details: ProposalScopeDetails | null | undefined;
  mode?: "all" | "phase" | "exclusions";
}) {
  if (!details) return null;
  const sections = [
    { key: "outcome", label: "Outcome", lines: details.objective ? [details.objective] : [] },
    { key: "scope", label: "Included scope", lines: details.scopeItems },
    { key: "deliverables", label: "Deliverables", lines: details.deliverables },
    { key: "acceptance", label: "Acceptance", lines: details.acceptanceCriteria },
    { key: "exclusions", label: "Not included", lines: details.exclusions },
  ].filter((section) => section.lines.length > 0 && (mode === "all" || (mode === "phase" && section.key !== "exclusions") || (mode === "exclusions" && section.key === "exclusions")));
  if (sections.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sections.map((section) => (
        <div key={section.label}>
          <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>{section.label}</div>
          {section.lines.length === 1 ? (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>{section.lines[0]}</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              {section.lines.map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

const fmtWhen = (v: Date | string | null) =>
  v ? new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

const blankScope = (): ProposalScopeDetails => ({ objective: "", scopeItems: [], deliverables: [], acceptanceCriteria: [], exclusions: [] });

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

export function ProposalEditor({ proposal, canManage, trainingMode = false }: { proposal: Proposal; canManage: boolean; trainingMode?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [amendConfirmIndex, setAmendConfirmIndex] = useState<number | null>(null);
  const [respond, setRespond] = useState({ outcome: "", optionId: "", name: "", note: "" });
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => new Set());

  const isDraft = proposal.status === "draft" && canManage;
  const isLocked = !isDraft;

  function setPhaseExpanded(optionId: string, phaseIndex: number, expanded: boolean) {
    const key = `${optionId}:${phaseIndex}`;
    setExpandedPhases((current) => {
      const next = new Set(current);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Local editable copies (draft only) — source of truth while typing; autosaved.
  const [summary, setSummary] = useState(proposal.executiveSummaryMd ?? "");
  const fromServer = (o: Option) => ({
    ...o,
    priceDollars: o.priceCents > 0 ? String(o.priceCents / 100) : "",
    phases: o.phases ? o.phases.map((p) => ({ ...p, amountDollars: p.amountCents > 0 ? String(p.amountCents / 100) : "" })) : null,
  });
  const [opts, setOpts] = useState(proposal.options.map(fromServer));

  // Structural server truth (recommended flag, option membership, names) changes via
  // PATCH + router.refresh — merge it back into the local copies or the cards render
  // stale (e.g. "Mark recommended" never turning the card green). Locally-typed fields
  // (price, timeline, phases) are preserved for options that already exist.
  const structuralSig = proposal.options.map((o) => `${o.id}:${o.recommended ? 1 : 0}:${o.name}`).join("|");
  useEffect(() => {
    setOpts((prev) =>
      proposal.options.map((o) => {
        const local = prev.find((x) => x.id === o.id);
        return local ? { ...local, recommended: o.recommended, name: o.name, label: o.label } : fromServer(o);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralSig]);

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

  function optionSaveBody(o: (typeof opts)[number]) {
    return {
      name: o.name,
      summaryMd: o.summaryMd,
      scopeDetails: o.scopeDetails,
      timelineNote: o.timelineNote ?? "",
      priceCents: o.priceDollars ? Math.round(parseFloat(o.priceDollars) * 100) || 0 : 0,
      phases: o.phases ? o.phases.map((p) => ({
        name: p.name,
        amountCents: p.amountDollars ? Math.round(parseFloat(p.amountDollars) * 100) || 0 : 0,
        weeks: p.weeks,
        internalNote: p.internalNote,
        scopeDetails: p.scopeDetails,
      })) : null,
    };
  }

  const saveOption = useDebounced((optionId: string) => {
    const o = opts.find((x) => x.id === optionId);
    if (!o) return;
    void api(`/api/proposals/${proposal.id}/options/${optionId}`, "PATCH", optionSaveBody(o)).then((ok) => ok && flashSaved());
  }, 600);

  async function persistDraft(key: "save" | "preview", refresh: boolean): Promise<boolean> {
    setBusy(key);
    let ok = await api(`/api/proposals/${proposal.id}`, "PATCH", { executiveSummaryMd: summary });
    for (const o of opts) {
      if (!ok) break;
      ok = await api(`/api/proposals/${proposal.id}/options/${o.id}`, "PATCH", optionSaveBody(o));
    }
    setBusy(null);
    if (ok) {
      flashSaved();
      if (refresh) router.refresh();
    }
    return ok;
  }

  async function viewAsClient() {
    if (isDraft) {
      const ok = await persistDraft("preview", false);
      if (!ok) return;
    }
    router.push(`/dashboard/proposals/${proposal.id}/preview`);
  }

  function patchOpt(optionId: string, patch: Partial<(typeof opts)[number]>) {
    setOpts((v) => v.map((o) => (o.id === optionId ? { ...o, ...patch } : o)));
    saveOption(optionId);
  }

  function patchOptionScope(optionId: string, key: keyof ProposalScopeDetails, value: string | string[]) {
    const option = opts.find((item) => item.id === optionId);
    if (!option) return;
    const scope = option.scopeDetails ?? blankScope();
    patchOpt(optionId, {
      scopeDetails: {
        ...scope,
        [key]: value,
      },
    });
  }

  function patchPhaseScope(optionId: string, phaseIndex: number, key: keyof ProposalScopeDetails, value: string | string[]) {
    const option = opts.find((item) => item.id === optionId);
    if (!option?.phases) return;
    patchOpt(optionId, {
      phases: option.phases.map((phase, index) => index === phaseIndex
        ? {
            ...phase,
            scopeDetails: {
              ...(phase.scopeDetails ?? blankScope()),
              [key]: value,
            },
          }
        : phase),
    });
  }

  async function structural(fn: () => Promise<boolean>, key: string) {
    setBusy(key);
    const ok = await fn();
    setBusy(null);
    if (ok) router.refresh();
    return ok;
  }

  /**
   * Optimistic recommended toggle — the green flips NOW, the save lands in the
   * background (2 server round-trips otherwise made this feel 2–3s sluggish).
   * Mirrors setRecommendedOption's semantics: clicking the recommended option
   * un-marks it; marking one un-marks the rest. A failed save visibly reverts.
   */
  function toggleRecommended(optionId: string) {
    const prev = opts;
    const wasRec = prev.find((o) => o.id === optionId)?.recommended ?? false;
    setOpts((v) => v.map((o) => ({ ...o, recommended: o.id === optionId ? !wasRec : false })));
    void (async () => {
      const ok = await api(`/api/proposals/${proposal.id}/options/${optionId}`, "PATCH", { toggleRecommended: true });
      if (!ok) setOpts(prev);
      else router.refresh(); // background truth-up — the resync effect merges it without clobbering typing
    })();
  }

  // ---------------------------------------------------------------- send (09 Jul b: stage follows the proposal)

  // Sending is the only forward path out of Discovery; evidence coaching fires here.
  const sendWillAdvance = proposal.dealStage === "discovery" || proposal.dealStage === "new";
  const proposalEvidence = proposalReadinessFrom(proposal.dealReadiness ?? 0, proposal.dealBuyingPathStatus);
  const belowSolutionClarity = !proposalEvidence.readyToDraft;
  const sendNeedsNudge = sendWillAdvance && !proposalEvidence.readyToSend;

  function recordSendOverride() {
    return fetch(`/api/deals/${proposal.dealId}/readiness`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outcome: "overridden", metadata: { surface: "proposal_send", proposalId: proposal.id } }),
    }).catch(() => {});
  }

  /** The full send path (§2): status sent + share token + auto-advance, one transaction server-side. */
  async function doSend(): Promise<boolean> {
    return structural(async () => {
      try {
        const res = await fetch(`/api/proposals/${proposal.id}/send`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { message?: string; movedToProposalOut?: boolean };
        if (!res.ok) {
          setError(data.message ?? `Failed (${res.status}).`);
          return false;
        }
        setError(null);
        setConfirmSend(false);
        if (sendNeedsNudge && !trainingMode) {
          // Frame 39's training-off inline variant, now on Send: quiet, logged.
          void recordSendOverride();
          const reason = belowSolutionClarity
            ? `Discovery Package ${(proposal.dealReadiness ?? 0).toFixed(1)}/10`
            : `buying path ${proposal.dealBuyingPathStatus}`;
          setFlash(`Sent — deal moved to "Proposal out" · ⚠ ${reason}, override logged`);
        } else {
          setFlash(data.movedToProposalOut ? 'Sent — deal moved to "Proposal out"' : "Sent — share link is live");
        }
        return true;
      } catch {
        setError("Network error — please try again.");
        return false;
      }
    }, "send");
  }

  function onSendClick() {
    // Training mode + below the bar → the nudge decides: hold the send, or send anyway.
    if (sendNeedsNudge && trainingMode) setNudge(true);
    else setConfirmSend(true);
  }

  async function refreshFromDiscovery() {
    if (!window.confirm("Create a new AI-grounded draft from the latest discovery evidence? Your current draft will be kept as the prior version, not overwritten.")) return;
    setBusy("refresh-discovery");
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/refresh`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; proposalId?: string };
      if (!res.ok || !data.proposalId) {
        setError(data.message ?? "Could not create a refreshed draft.");
        return;
      }
      router.push(`/dashboard/proposals/${data.proposalId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function markEvidenceReviewed() {
    if (!window.confirm("Confirm that you reviewed the latest discovery and buying-path evidence and manually reconciled this draft. This keeps the current draft and clears its refresh warning.")) return;
    setBusy("review-evidence");
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/review-evidence`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Could not mark this draft as reviewed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
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
    <aside style={{ background: "var(--ink)", borderRadius: 14, padding: "16px 14px", color: "#cfd2da", alignSelf: "stretch" }}>
      <div className="kicker" style={{ color: "#6b7079", marginBottom: 10 }}>Phased agreement</div>
      {/* Steps — one progress rail: the connector line runs behind the dots */}
      <div style={{ position: "relative" }}>
        {spinePhases && spinePhases.length > 0 && (
          <span aria-hidden style={{ position: "absolute", left: 9, top: 10, bottom: 10, width: 2, background: "#2c2f36" }} />
        )}
      {/* Master signature */}
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", paddingBottom: 14 }}>
        <span style={{ width: 20, height: 20, borderRadius: 999, background: sigDot.bg, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "none", position: "relative", zIndex: 1 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
          {spinePhases.map((ph, i) => {
            const dot = ph.status === "done" ? { bg: "#16a34a", icon: "✓" } : ph.status === "active" ? { bg: "#2b3ee6", icon: String(i + 1) } : { bg: "#2c2f36", icon: String(i + 1) };
            const note = ph.status === "done" ? "delivered" : ph.status === "active" ? "active now" : "awaits amendment";
            return (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ width: 20, height: 20, borderRadius: 999, background: dot.bg, color: ph.status === "awaiting_amendment" ? "#8b909a" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none", position: "relative", zIndex: 1, boxShadow: "0 0 0 3px var(--ink)" }}>
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
        <div className="mono" style={{ fontSize: 10, color: "#8b909a", paddingBottom: 12 }}>
          {chosen ? "single delivery — no phases" : "no options yet"}
        </div>
      )}
      </div>

      {/* Approvers */}
      <div style={{ paddingTop: 12, borderTop: "1px solid #2c2f36" }}>
        <div className="kicker" style={{ color: "#6b7079", marginBottom: 7 }}>Eligible approvers</div>
        {(proposal.approvers ?? []).length === 0 ? (
          <div className="mono" style={{ fontSize: 10, color: "#8b909a" }}>none captured</div>
        ) : (
          (proposal.approvers ?? []).map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0" }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: "#2b3ee6", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flex: "none" }}>
                {a.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--white)", minWidth: 0 }}>
                {a.name}
                {a.role ? <span style={{ color: "#8b909a", fontWeight: 600 }}> — {a.role}</span> : null}
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  );

  // ---------------------------------------------------------------- main

  // No alignItems:start on the grid — the ink spine stretches to the full height of the page beside it.
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18 }}>
      {spine}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Header row: ORG · V{n} · status pill · COMPLEXITY dots (design layout) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="kicker" style={{ fontSize: 10 }}>
            {proposal.organizationId ? (
              <Link href={`/dashboard/accounts/${proposal.organizationId}`} style={{ color: "inherit" }}>
                {proposal.organizationName}
              </Link>
            ) : (
              proposal.organizationName
            )}
            {" · "}v{proposal.version}
          </span>
          <ProposalStatusPill status={proposal.status} />
          <span className="kicker" style={{ fontSize: 9.5, marginLeft: 4 }}>Complexity</span>
          <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={isDraft ? () => void structural(() => api(`/api/proposals/${proposal.id}`, "PATCH", { complexityScore: n }), "complexity") : undefined}
                title={`C${n}${complexity > 3 ? " — needs engineering review" : ""}`}
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 999,
                  border: "1px solid " + (n <= complexity ? (complexity > 3 ? "#B45309" : "#2b3ee6") : "#d7d9df"),
                  background: n <= complexity ? (complexity > 3 ? "#B45309" : "#2b3ee6") : "#EDEDF1",
                  cursor: isDraft ? "pointer" : "default",
                  padding: 0,
                }}
              />
            ))}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {saved && <span className="mono" style={{ fontSize: 10, color: "#15803d" }}>saved ✓</span>}
            <ProposalViewSwitcher
              mode="staff"
              onClient={() => void viewAsClient()}
              busy={busy === "preview"}
            />
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-.025em" }}>{proposal.dealName}</h1>

        {proposal.draftNeedsRefresh && isDraft && (
          <section style={{ background: "#FFF7ED", border: "1px solid #FADCB4", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#B45309" }}>Discovery changed after this draft was created</div>
            <p style={{ margin: "5px 0 10px", fontSize: 12.5, color: "#92400E", lineHeight: 1.5 }}>
              This proposal remains editable, but its scope may no longer match the latest discovery or buying-path evidence. Review the deal before sending.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link href={`/dashboard/sales/deals/${proposal.dealId}`} style={{ ...btn("plain"), textDecoration: "none", color: "#92400E", borderColor: "#F2D58A" }}>Review discovery →</Link>
              <button onClick={() => void refreshFromDiscovery()} disabled={busy === "refresh-discovery"} style={btn("ink", busy === "refresh-discovery")}>
                {busy === "refresh-discovery" ? "Creating refreshed draft…" : "Refresh draft with AI"}
              </button>
              <button onClick={() => void markEvidenceReviewed()} disabled={busy === "review-evidence"} style={btn("plain", busy === "review-evidence")}>
                {busy === "review-evidence" ? "Marking reviewed…" : "Mark reviewed — keep this draft"}
              </button>
              <span className="mono" style={{ fontSize: 9.5, color: "#A16207" }}>AI refresh creates a new version · reviewed keeps this draft</span>
            </div>
          </section>
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
              placeholder="What does this client need, and why this approach?"
              style={{ ...inputStyle, width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          )}
          {isLocked && (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-soft)" }}>
              {proposal.executiveSummaryMd || <span style={{ color: "var(--muted-line)" }}>No summary written.</span>}
            </p>
          )}
        </section>

        {proposal.coverage && (proposal.coverage.items.length > 0 || proposal.coverage.warnings.length > 0) && (
          <section style={{ background: "#FFFBEB", border: "1px solid #F2D58A", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div className="kicker" style={{ color: "#92400E" }}>MVP coverage review</div>
              <span className="mono" style={{ fontSize: 9.5, color: "#A16207" }}>internal AI checklist · verify before send</span>
            </div>
            {proposal.coverage.warnings.length > 0 && (
              <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 8, background: "#FEF3C7", color: "#92400E", fontSize: 11.5, lineHeight: 1.45 }}>
                {proposal.coverage.warnings.map((warning, index) => <div key={index}>⚠ {warning}</div>)}
              </div>
            )}
            <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
              {proposal.coverage.items.map((item, index) => (
                <div key={index} style={{ background: "rgba(255,255,255,.72)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 750 }}>{item.priority}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                    {item.placements.map((placement) => {
                      const tone = placement.disposition === "included" ? { bg: "#DCF5E3", fg: "#15803D" } : placement.disposition === "deferred" ? { bg: "#EEF0FE", fg: "#2536C4" } : { bg: "#FBE3E3", fg: "#B91C1C" };
                      return (
                        <span key={placement.optionLabel} title={placement.note} className="mono" style={{ fontSize: 9.5, borderRadius: 999, padding: "3px 7px", background: tone.bg, color: tone.fg }}>
                          {placement.optionLabel} · {placement.disposition}{placement.phaseName ? ` · ${placement.phaseName}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
        <div className="kicker" style={{ marginTop: 2 }}>Options</div>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: -6 }}>
          {opts.map((o) => (
            <div
              key={o.id}
              style={{
                background: o.recommended || o.id === proposal.selectedOptionId ? "#F4FBF7" : "var(--white)",
                border: o.id === proposal.selectedOptionId ? "2px solid #16a34a" : o.recommended ? "2px solid #A7DDB9" : "1px solid var(--border)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: o.recommended || o.id === proposal.selectedOptionId ? "#16a34a" : "var(--ink)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flex: "none" }}>
                  {o.label}
                </span>
                <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                {o.id === proposal.selectedOptionId && (
                  <span className="kicker" style={{ fontSize: 9, background: "#DCF5E3", color: "#15803D", borderRadius: 5, padding: "3px 7px", flex: "none" }}>SIGNED</span>
                )}
                {/* Recommended — admin-chosen; clicking the green label toggles it OFF */}
                {o.recommended ? (
                  <button
                    onClick={() => (isDraft ? toggleRecommended(o.id) : undefined)}
                    title={isDraft ? "Click to un-mark" : undefined}
                    className="kicker"
                    style={{ border: 0, background: "none", color: "#15803D", fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em", cursor: isDraft ? "pointer" : "default", padding: 0, flex: "none" }}
                  >
                    RECOMMENDED
                  </button>
                ) : isDraft ? (
                  <button
                    onClick={() => toggleRecommended(o.id)}
                    style={{ border: 0, background: "none", color: "var(--muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, flex: "none" }}
                  >
                    Mark recommended
                  </button>
                ) : null}
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
                      placeholder="Timeline note, e.g. ~10 weeks"
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

              {isDraft && (
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border-softer)", paddingTop: 9 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="kicker" style={{ fontSize: 8.5 }}>Option overview</span>
                    <textarea
                      value={o.summaryMd}
                      onChange={(event) => patchOpt(o.id, { summaryMd: event.target.value })}
                      placeholder="Why the client would choose this option and its tradeoff"
                      style={{ ...inputStyle, minHeight: 62, resize: "vertical", fontFamily: "inherit", lineHeight: 1.4 }}
                    />
                  </label>
                  {o.phases === null ? (
                    <ScopeDetailsEditor details={o.scopeDetails ?? blankScope()} onChange={(key, value) => patchOptionScope(o.id, key, value)} />
                  ) : (
                    <div style={{ display: "grid", gap: 4 }}>
                      <ScopeItemCards
                        label="Not included"
                        items={(o.scopeDetails ?? blankScope()).exclusions}
                        placeholder="Excluded from the entire option"
                        onChange={(items) => patchOptionScope(o.id, "exclusions", items)}
                      />
                      <span style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.35 }}>
                        Applies to the entire option. Work planned for a later phase is not excluded.
                      </span>
                    </div>
                  )}
                </div>
              )}
              {isLocked && (
                <div style={{ display: "grid", gap: 9, borderTop: "1px solid var(--border-softer)", paddingTop: 9 }}>
                  {o.summaryMd && (
                    <div>
                      <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>Option overview</div>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{o.summaryMd}</p>
                    </div>
                  )}
                  <ScopeDetailsRead details={o.scopeDetails} mode={o.phases === null ? "all" : "exclusions"} />
                </div>
              )}

              {/* Phases */}
              {o.phases !== null && (
                <div style={{ borderTop: "1px solid var(--border-softer)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="kicker" style={{ fontSize: 9.5 }}>Phases</div>
                  {o.phases.map((ph, i) => {
                    const expansionKey = `${o.id}:${i}`;
                    const expanded = expandedPhases.has(expansionKey);
                    const details = ph.scopeDetails ?? blankScope();
                    const detailSummary = `${details.scopeItems.length} scope · ${details.deliverables.length} deliverables · ${details.acceptanceCriteria.length} acceptance`;
                    return (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        background: "var(--white)",
                        border: "1px solid #DDE1EE",
                        borderLeft: "3px solid #5362D9",
                        borderRadius: 11,
                        overflow: "hidden",
                        boxShadow: "0 2px 8px rgba(31, 38, 75, 0.05)",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8, background: "#F7F8FC", borderBottom: "1px solid #E3E6EF", padding: "11px 12px" }}>
                        {isDraft && (
                          <>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                              <span className="mono" style={{ flex: "none", borderRadius: 999, background: "#E6E9FF", color: "#3443B8", padding: "5px 8px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em" }}>
                                PHASE {i + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                                <input
                                  aria-label={`Phase ${i + 1} title`}
                                  value={ph.name}
                                  onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)) })}
                                  style={{ ...inputStyle, width: "100%", minWidth: 0, fontSize: 15, fontWeight: 800, padding: "8px 10px" }}
                                />
                                {!expanded && (
                                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", paddingLeft: 1 }}>
                                    {detailSummary}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => patchOpt(o.id, { phases: o.phases!.filter((_, j) => j !== i) })}
                                title="Remove phase"
                                aria-label={`Remove phase ${i + 1}`}
                                style={{ flex: "none", width: 26, height: 26, border: 0, borderRadius: 7, background: "transparent", color: "#A8ADB8", fontSize: 14, cursor: "pointer", padding: 0 }}
                              >
                                ✕
                              </button>
                            </div>
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", paddingLeft: 1, flexWrap: "wrap" }}>
                              <label style={{ display: "grid", gap: 3 }}>
                                <span className="kicker" style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-soft)" }}>Phase fee</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ color: "var(--ink)", fontSize: 13, fontWeight: 800 }}>$</span>
                                  <input
                                    aria-label={`Phase ${i + 1} fee`}
                                    value={ph.amountDollars}
                                    onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, amountDollars: e.target.value.replace(/[^0-9.]/g, "") } : p)) })}
                                    placeholder="0"
                                    inputMode="numeric"
                                    style={{ ...inputStyle, width: 96, borderColor: "#C9CEDD", fontSize: 13, fontWeight: 800, padding: "7px 9px" }}
                                  />
                                </div>
                              </label>
                              <label style={{ display: "grid", gap: 3 }}>
                                <span className="kicker" style={{ fontSize: 9, fontWeight: 800, color: "var(--ink-soft)" }}>Duration</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <input
                                    aria-label={`Phase ${i + 1} duration in weeks`}
                                    value={String(ph.weeks)}
                                    onChange={(e) => patchOpt(o.id, { phases: o.phases!.map((p, j) => (j === i ? { ...p, weeks: Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0) } : p)) })}
                                    inputMode="numeric"
                                    style={{ ...inputStyle, width: 54, borderColor: "#C9CEDD", fontSize: 13, fontWeight: 800, padding: "7px 9px" }}
                                  />
                                  <span style={{ color: "var(--ink-soft)", fontSize: 11, fontWeight: 700 }}>weeks</span>
                                </div>
                              </label>
                              <span style={{ marginLeft: "auto", alignSelf: "flex-end" }}>
                                <ExpandCollapseButton expanded={expanded} onClick={() => setPhaseExpanded(o.id, i, !expanded)} label={`phase ${i + 1} details`} />
                              </span>
                            </div>
                          </>
                        )}
                        {isLocked && (
                          <>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                              <span className="mono" style={{ flex: "none", borderRadius: 999, background: "#E6E9FF", color: "#3443B8", padding: "5px 8px", fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em" }}>
                                PHASE {i + 1}
                              </span>
                              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                                <h4 style={{ margin: 0, color: "var(--ink)", fontSize: 15, lineHeight: 1.25 }}>{ph.name}</h4>
                                {!expanded && (
                                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)" }}>
                                    {detailSummary}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-soft)", paddingBottom: 7 }}>
                                <Money cents={ph.amountCents} /> · {ph.weeks} weeks
                                {o.id === proposal.selectedOptionId && (
                                  <span style={{ color: ph.status === "active" ? "#2536C4" : ph.status === "done" ? "#15803D" : "var(--muted-line)" }}>
                                    {" "}· {ph.status === "done" ? "delivered" : ph.status === "active" ? "active" : "awaits amendment"}
                                  </span>
                                )}
                              </div>
                              <span style={{ marginLeft: "auto" }}>
                                <ExpandCollapseButton expanded={expanded} onClick={() => setPhaseExpanded(o.id, i, !expanded)} label={`phase ${i + 1} details`} />
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {expanded && (
                        <div style={{ padding: 12 }}>
                          {isDraft
                            ? <ScopeDetailsEditor compact includeExclusions={false} details={details} onChange={(key, value) => patchPhaseScope(o.id, i, key, value)} />
                            : <ScopeDetailsRead details={ph.scopeDetails} mode="phase" />}
                        </div>
                      )}
                    </div>
                    );
                  })}
                  {isDraft && (
                    <button
                      onClick={() => {
                        const newPhaseIndex = o.phases!.length;
                        patchOpt(o.id, { phases: [...o.phases!, { name: `Phase ${newPhaseIndex + 1}`, amountCents: 0, amountDollars: "", weeks: 2, status: "awaiting_amendment" as const, scopeDetails: blankScope() }] });
                        setPhaseExpanded(o.id, newPhaseIndex, true);
                      }}
                      style={{ alignSelf: "flex-start", border: 0, background: "none", color: "#15803D", padding: 0, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      + Add phase
                    </button>
                  )}
                </div>
              )}
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
        {flash && (
          <p className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: flash.startsWith("Held") ? "#2536C4" : "#15803D", margin: 0 }}>
            {flash}
            <button onClick={() => setFlash(null)} style={{ border: 0, background: "none", color: "#C4C8CF", cursor: "pointer", marginLeft: 8 }}>×</button>
          </p>
        )}

        {/* Action row: Save draft · Send to client → · Generate contract/SOW · Delete */}
        {canManage && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {isDraft && (
              <button
                onClick={() => void persistDraft("save", true)}
                disabled={busy === "save"}
                style={btn("plain", busy === "save")}
              >
                {busy === "save" ? "Saving…" : "Save draft"}
              </button>
            )}
            {isDraft && (
              <button onClick={onSendClick} disabled={busy === "send"} style={btn("ink", busy === "send")}>
                Send to client →
              </button>
            )}
            {proposal.contract ? (
              <Link href={`/dashboard/proposals/${proposal.id}/contract`} style={{ ...btn("plain"), textDecoration: "none", display: "inline-block" }}>
                ◆ View contract / SOW →
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
                style={btn("plain", busy === "contract")}
              >
                {busy === "contract" ? "Generating…" : "◆ Generate contract / SOW with AI"}
              </button>
            )}
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
                <button onClick={() => void doSend()} disabled={busy === "send"} style={btn(complexity > 3 ? "plain" : "ink", busy === "send")}>
                  {busy === "send" ? "Sending…" : complexity > 3 ? "Send anyway" : "Send"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Readiness nudge on Send (09 Jul b — replaces the stage-drag trigger) */}
        {nudge && (
          <ReadinessNudgeModal
            dealId={proposal.dealId}
            dealName={proposal.dealName}
            variant="send"
            onKeep={() => {
              setNudge(false);
              setFlash("Held — the draft keeps, deal stays in Discovery");
            }}
            onAdvance={() => {
              setNudge(false);
              void recordSendOverride();
              void doSend();
            }}
            onClose={() => setNudge(false)}
          />
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
