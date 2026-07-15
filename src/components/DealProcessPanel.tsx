"use client";

/**
 * Deal process panel (frame 38) — the training layer + the Discovery Package data.
 * Training mode is a LAYER on the real deal view, never a parallel UI: the goal
 * rail, explain callouts, and next-best-action card render only when it's on; the
 * package card and recorded calls are real deal data and always render (the explain
 * strings become tooltips when training is off).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BUYING_PATH_FIELDS, BUYING_PATH_GUIDANCE, BUYING_PATH_LABELS, DISCOVERY_SCRIPT_FIELDS, DISCOVERY_SCRIPT_GROUPS, EXPLAIN, PACKAGE_FIELDS, PACKAGE_FIELD_GUIDANCE, PACKAGE_FIELD_LABELS, PROPOSAL_READY_AT, manualFieldStatusForSave, nextCallPrompts, packageStatusForBudget, proposalReadinessFrom, type BuyingPath, type BuyingPathFieldKey, type PackageFields, type PackageFieldStatus } from "@/domain/process";
import {
  COMMERCIAL_REVIEW_FIELDS,
  COMMERCIAL_REVIEW_LABELS,
  QUALIFICATION_REVIEW_FIELDS,
  QUALIFICATION_REVIEW_LABELS,
  type CommercialReviewField,
  type DiscoveryAnalysis,
  type DiscoveryReviewRecommendation,
  type DiscoveryReviewSelection,
  type DiscoveryReviewStatus,
  type QualificationReviewField,
} from "@/domain/discovery-review";
import {
  BUDGET_STATUS_LABELS,
  BUDGET_STATUSES,
  DATA_SENSITIVITY_LABELS,
  DELIVERY_MODEL_LABELS,
  ENGAGEMENT_TYPE_LABELS,
  IP_DISPOSITION_LABELS,
  NEXT_ACTION_COURT_LABELS,
  type BudgetStatus,
} from "@/domain/deal-operating-model";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { FieldHelp } from "@/components/FieldHelp";

type Call = {
  id: string;
  title: string;
  recordedAt: string;
  durationMin: number | null;
  fieldsExtracted: number;
  reviewStatus: DiscoveryReviewStatus;
};
type NextAction = { n: number; text: string; active: boolean };
type ReviewView = {
  callId: string;
  title: string;
  analysis: DiscoveryAnalysis;
  recommended: DiscoveryReviewRecommendation;
};

const TONE = {
  green: { bg: "#DCF5E3", fg: "#15803D" },
  amber: { bg: "#FCEFDC", fg: "#B45309" },
  red: { bg: "#FBE3E3", fg: "#B91C1C" },
} as const;

export function ReadyPill({ score, tone }: { score: number | null; tone: "green" | "amber" | "red" }) {
  const c = TONE[tone];
  return (
    <span className="mono" style={{ fontSize: 10, fontWeight: 800, background: c.bg, color: c.fg, borderRadius: 999, padding: "3px 10px" }}>
      {score === null ? "DISCOVERY NOT SCORED" : `DISCOVERY ${score.toFixed(1)}/10`}
    </span>
  );
}

function Explain({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--cobalt-wash)", border: "1px solid #DDE1FB", borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--cobalt)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none", marginTop: 1 }}>
        ?
      </span>
      <p style={{ margin: 0, fontSize: 12, color: "#2536C4", lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

export function ProcessSectionHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        flexWrap: "wrap",
        minHeight: 24,
        marginBottom: 8,
        padding: "7px 9px",
        background: "#F6F7FB",
        border: "1px solid #E4E7F0",
        borderRadius: 9,
      }}
    >
      <span aria-hidden="true" style={{ width: 3, height: 20, borderRadius: 999, background: "var(--cobalt)", flex: "none" }} />
      <span className="kicker" style={{ color: "#303642", fontSize: 10.5, fontWeight: 900, letterSpacing: ".09em" }}>
        {title}
      </span>
      {trailing && <span style={{ marginLeft: "auto" }}>{trailing}</span>}
    </div>
  );
}

function BuyingPathCard({ dealId, path, canManage }: { dealId: string; path: BuyingPath; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BuyingPathFieldKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ status: PackageFieldStatus | null; evidence: string; budgetStatus: BudgetStatus }>({ status: null, evidence: "", budgetStatus: path.budgetStatus });
  const colors = path.status === "confirmed"
    ? { bg: TONE.green.bg, fg: TONE.green.fg }
    : path.status === "developing"
      ? { bg: TONE.amber.bg, fg: TONE.amber.fg }
      : { bg: TONE.red.bg, fg: TONE.red.fg };

  const statusOptions: { value: PackageFieldStatus; label: string; color: (typeof TONE)[keyof typeof TONE] }[] = [
    { value: "ok", label: "✓ ok", color: TONE.green },
    { value: "partial", label: "– partial", color: TONE.amber },
    { value: "missing", label: "✕ missing", color: TONE.red },
  ];

  function openEditor(key: BuyingPathFieldKey) {
    const field = path.fields[key];
    setForm({ status: field?.source ? field.status : null, evidence: field?.evidence ?? "", budgetStatus: path.budgetStatus });
    setError(null);
    setEditing(key);
  }

  async function save() {
    if (!editing) return;
    const status = editing === "budget" ? packageStatusForBudget(form.budgetStatus) : manualFieldStatusForSave(form.status);
    if (editing !== "budget" && !form.status && !form.evidence.trim()) {
      setError("Enter what you learned, or explicitly choose Partial or Missing.");
      return;
    }
    if (status !== "missing" && !form.evidence.trim()) {
      setError("Enter the evidence supporting this selection.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/discovery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ area: "buying_path", field: editing, status, evidence: form.evidence, budgetStatus: editing === "budget" ? form.budgetStatus : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else {
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <ProcessSectionHeader
        title="Buying path"
        trailing={
        <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, color: colors.fg, background: colors.bg, borderRadius: 999, padding: "3px 9px" }}>
          {path.status.toUpperCase()} · {path.completed}/{path.total}
        </span>
        }
      />
      <p style={{ margin: "6px 0 9px", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.45 }}>
        Can this customer actually buy? Confirm the people, urgency, approval steps, and funding path behind a credible purchase.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", columnGap: 16, rowGap: 7 }}>
        {BUYING_PATH_FIELDS.map((key) => {
          const field = path.fields[key];
          const status = field?.status ?? "missing";
          const color = status === "ok" ? TONE.green : status === "partial" ? TONE.amber : TONE.red;
          const isEditing = editing === key;
          const guidance = BUYING_PATH_GUIDANCE[key];
          return (
            <div key={key} style={{ padding: "5px 0" }}>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: color.bg, color: color.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flex: "none", marginTop: 1 }}>{status === "ok" ? "✓" : status === "partial" ? "–" : "✕"}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700 }}>{BUYING_PATH_LABELS[key]}</span>
                    <FieldHelp label={BUYING_PATH_LABELS[key]}>
                      <span className="field-help__definitions"><span>{guidance.meaning}</span><span><b>Why it matters:</b> {guidance.why}</span><span><b>Ask or listen for:</b> {guidance.ask}</span></span>
                    </FieldHelp>
                    {canManage && <button onClick={() => isEditing ? setEditing(null) : openEditor(key)} className="mono" style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 9, fontWeight: 700, cursor: "pointer", padding: 0 }}>{isEditing ? "close" : "edit"}</button>}
                  </div>
                  {field?.evidence && !isEditing && <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 1 }}>{key === "budget" ? `${BUDGET_STATUS_LABELS[path.budgetStatus]} · ` : ""}{field.evidence}</div>}
                </div>
              </div>
              {isEditing && (
                <div style={{ margin: "7px 0 2px 23px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {key !== "budget" && <div style={{ display: "flex", gap: 5 }}>{statusOptions.map((option) => <button key={option.value} onClick={() => setForm((current) => ({ ...current, status: option.value }))} className="mono" style={{ border: form.status === option.value ? `1.5px solid ${option.color.fg}` : "1px solid #d7d9df", background: form.status === option.value ? option.color.bg : "var(--white)", color: form.status === option.value ? option.color.fg : "var(--muted)", borderRadius: 999, padding: "3px 9px", fontSize: 9.5, fontWeight: 800, cursor: "pointer" }}>{option.label}</button>)}</div>}
                  {key === "budget" && (
                    <>
                      <select style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 11.5, background: "var(--white)" }} value={form.budgetStatus} onChange={(e) => { const budgetStatus = e.target.value as BudgetStatus; setForm((current) => ({ ...current, budgetStatus, status: packageStatusForBudget(budgetStatus) })); }}>{BUDGET_STATUSES.map((value) => <option key={value} value={value}>{BUDGET_STATUS_LABELS[value]}</option>)}</select>
                      <p className="mono" style={{ margin: 0, fontSize: 9.5, color: "var(--muted-line)" }}>Unknown = Missing · Possible source = Partial · Identified or confirmed = OK</p>
                    </>
                  )}
                  <textarea style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 11.5, minHeight: 54, fontFamily: "inherit", resize: "vertical" }} placeholder="What did they say? (evidence)" maxLength={500} value={form.evidence} onChange={(e) => setForm((current) => ({ ...current, evidence: e.target.value }))} />
                  {key !== "budget" && !form.status && form.evidence.trim() && <p className="mono" style={{ color: TONE.green.fg, fontSize: 9.5, margin: 0 }}>No status selected · Save will mark this OK.</p>}
                  {error && <p style={{ margin: 0, color: TONE.red.fg, fontSize: 11 }}>{error}</p>}
                  <div style={{ display: "flex", gap: 8 }}><button onClick={() => void save()} disabled={busy} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{busy ? "Saving…" : key === "budget" ? "Save funding status" : form.status ? "Save" : "Save as OK"}</button><button onClick={() => setEditing(null)} disabled={busy} style={{ border: 0, background: "none", color: "var(--muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Cancel</button></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, borderTop: "1px solid var(--border-softer)", paddingTop: 9, fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
        <b>What this tells you:</b> Unverified means the purchase path is still unknown. Developing means some evidence exists but at least one item is incomplete. Confirmed means all five items are supported well enough to send a proposal with confidence.
      </div>
    </section>
  );
}

/** Goal rail (top of the deal view, training mode only). */
export function GoalRail({ goal, journey, journeyIndex }: { goal: string; journey: { key: string; label: string }[]; journeyIndex: number }) {
  return (
    <div style={{ background: "#EEF0FE", borderBottom: "1px solid #DDE1FB", borderRadius: 10, padding: "9px 13px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "var(--cobalt)", color: "var(--white)", borderRadius: 5, padding: "2px 7px", flex: "none" }}>
        TRAINING
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2536C4", flex: 1, minWidth: 180 }}>{goal}</span>
      <span className="mono" style={{ fontSize: 9.5, color: "#5A6BD8", flex: "none" }}>
        step {journeyIndex + 1} of {journey.length} ·{" "}
        {journey.map((s, i) => (i === journeyIndex ? "you are here" : s.label)).join(" → ")}
      </span>
    </div>
  );
}

function commercialValueLabel(key: CommercialReviewField, value: string): string {
  if (key === "engagementType" && value in ENGAGEMENT_TYPE_LABELS) return ENGAGEMENT_TYPE_LABELS[value as keyof typeof ENGAGEMENT_TYPE_LABELS];
  if (key === "deliveryModel" && value in DELIVERY_MODEL_LABELS) return DELIVERY_MODEL_LABELS[value as keyof typeof DELIVERY_MODEL_LABELS];
  if (key === "ipDisposition" && value in IP_DISPOSITION_LABELS) return IP_DISPOSITION_LABELS[value as keyof typeof IP_DISPOSITION_LABELS];
  if (key === "dataSensitivity" && value in DATA_SENSITIVITY_LABELS) return DATA_SENSITIVITY_LABELS[value as keyof typeof DATA_SENSITIVITY_LABELS];
  return value;
}

function DiscoveryReviewCard({ dealId, review, onDone }: { dealId: string; review: ReviewView; onDone: () => void }) {
  const router = useRouter();
  const [selection, setSelection] = useState<DiscoveryReviewSelection>(review.recommended);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleList<K extends string>(key: "packageFields" | "qualificationFields" | "commercialFields", value: K) {
    setSelection((current) => {
      const values = current[key] as string[];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  }

  async function resolve(action: "apply" | "dismiss") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/calls/${review.callId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, selection: action === "apply" ? selection : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else {
        onDone();
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const proposedPackage = DISCOVERY_SCRIPT_FIELDS.filter((key) => {
    const field = review.analysis.packageFields[key];
    return field.status !== "missing" || !!field.evidence?.trim();
  });
  const proposedQualification = QUALIFICATION_REVIEW_FIELDS.filter((key) => review.analysis.qualification[key].suggested);
  const proposedCommercial = COMMERCIAL_REVIEW_FIELDS.filter((key) => review.analysis.commercial[key].suggested);
  const proposedFollowUp = review.analysis.followUp.suggested;

  return (
    <div style={{ border: "1px solid #C9D0FB", background: "#FAFBFF", borderRadius: 12, padding: 13, display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
      <div>
        <div className="kicker" style={{ color: "var(--cobalt-text)" }}>Review AI evidence · {review.title}</div>
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
          Nothing below changes the Deal until you select it and apply. Commercial suggestions and agreed follow-ups start unchecked.
        </p>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
        <input type="checkbox" checked={selection.applyDiscoveryMd} onChange={(e) => setSelection((s) => ({ ...s, applyDiscoveryMd: e.target.checked }))} />
        <span style={{ minWidth: 0 }}>
          <b style={{ fontSize: 12.5 }}>Merge long-form discovery memo</b>
          <span style={{ display: "block", marginTop: 5, maxHeight: 150, overflowY: "auto", background: "var(--white)", border: "1px solid var(--border-soft)", borderRadius: 8, padding: "8px 10px" }}>
            <SimpleMarkdown md={review.analysis.discoveryMd} size={11.5} />
          </span>
        </span>
      </label>

      {proposedPackage.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 5 }}>Discovery Package evidence</div>
          {proposedPackage.map((key) => {
            const field = review.analysis.packageFields[key];
            return (
              <label key={key} style={{ display: "flex", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={selection.packageFields.includes(key)} onChange={() => toggleList("packageFields", key)} />
                <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <b>{PACKAGE_FIELD_LABELS[key]} · {field.status}</b>
                  {field.evidence && <span style={{ display: "block", color: "var(--ink-soft)" }}>{field.evidence}</span>}
                  {field.source && <span className="mono" style={{ display: "block", color: "var(--muted-line)", fontSize: 9.5 }}>{field.source}</span>}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {proposedQualification.length > 0 && (
        <div>
          <div className="kicker" style={{ marginBottom: 5 }}>Buying path evidence</div>
          {proposedQualification.map((key) => {
            const item = review.analysis.qualification[key];
            const value = key === "budgetStatus" && item.value in BUDGET_STATUS_LABELS
              ? BUDGET_STATUS_LABELS[item.value as keyof typeof BUDGET_STATUS_LABELS]
              : item.value;
            return (
              <label key={key} style={{ display: "flex", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={selection.qualificationFields.includes(key)} onChange={() => toggleList<QualificationReviewField>("qualificationFields", key)} />
                <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <b>{QUALIFICATION_REVIEW_LABELS[key]} → {value}</b>
                  <span style={{ display: "block", color: "var(--ink-soft)" }}>{item.evidence}</span>
                  <span className="mono" style={{ display: "block", color: "var(--muted-line)", fontSize: 9.5 }}>{item.source}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {proposedCommercial.length > 0 && (
        <div style={{ borderTop: "1px solid #DDE1FB", paddingTop: 10 }}>
          <div className="kicker" style={{ marginBottom: 5, color: "#B45309" }}>Commercial suggestions · human decision required</div>
          {proposedCommercial.map((key) => {
            const item = review.analysis.commercial[key];
            return (
              <label key={key} style={{ display: "flex", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={selection.commercialFields.includes(key)} onChange={() => toggleList<CommercialReviewField>("commercialFields", key)} />
                <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <b>{COMMERCIAL_REVIEW_LABELS[key]} → {commercialValueLabel(key, item.value)}</b>
                  <span style={{ display: "block", color: "var(--ink-soft)" }}>{item.evidence}</span>
                  <span className="mono" style={{ display: "block", color: "var(--muted-line)", fontSize: 9.5 }}>{item.source}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {proposedFollowUp && (
        <div style={{ borderTop: "1px solid #DDE1FB", paddingTop: 10 }}>
          <div className="kicker" style={{ marginBottom: 5, color: "#B45309" }}>Agreed follow-up · explicit confirmation required</div>
          <label style={{ display: "flex", gap: 8, padding: "6px 0", cursor: "pointer" }}>
            <input type="checkbox" checked={selection.applyFollowUp} onChange={(e) => setSelection((current) => ({ ...current, applyFollowUp: e.target.checked }))} />
            <span style={{ fontSize: 12, lineHeight: 1.4 }}>
              <b>{review.analysis.followUp.action} · {review.analysis.followUp.dueAt}</b>
              <span className="mono" style={{ display: "block", color: "var(--muted)", fontSize: 9.5 }}>
                court: {review.analysis.followUp.court ? NEXT_ACTION_COURT_LABELS[review.analysis.followUp.court] : "not identified"}
              </span>
              <span style={{ display: "block", color: "var(--ink-soft)" }}>{review.analysis.followUp.evidence}</span>
              <span className="mono" style={{ display: "block", color: "var(--muted-line)", fontSize: 9.5 }}>{review.analysis.followUp.source}</span>
            </span>
          </label>
        </div>
      )}

      {error && <p style={{ margin: 0, color: "#b00020", fontSize: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => resolve("apply")} disabled={busy} style={{ border: 0, background: "var(--ink)", color: "var(--white)", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          {busy ? "Saving…" : "Apply selected updates"}
        </button>
        <button onClick={() => resolve("dismiss")} disabled={busy} style={{ border: "1px solid #d7d9df", background: "var(--white)", color: "var(--muted)", borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          Dismiss analysis
        </button>
      </div>
    </div>
  );
}

export function DealProcessPanel({
  dealId,
  canManage,
  trainingMode,
  readiness,
  tone,
  fields,
  nextActions,
  calls,
  buyingPath,
  openLog = 0,
  stage,
}: {
  dealId: string;
  canManage: boolean;
  trainingMode: boolean;
  readiness: number | null;
  tone: "green" | "amber" | "red";
  fields: PackageFields;
  nextActions: NextAction[];
  calls: Call[];
  buyingPath: BuyingPath;
  /** Bump to force the "Log a call" form open (the drawer footer's Log button). */
  openLog?: number;
  /** Deal stage — hides the ask-next-call strip once the asking window has passed (committed). */
  stage?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analyzingCallId, setAnalyzingCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", duration: "", transcript: "" });
  const [openTranscript, setOpenTranscript] = useState<{ id: string; text: string } | null>(null);
  const [editing, setEditing] = useState<(typeof PACKAGE_FIELDS)[number] | null>(null);
  const [editForm, setEditForm] = useState<{ status: PackageFieldStatus | null; evidence: string }>({ status: null, evidence: "" });
  const [fieldBusy, setFieldBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [askAll, setAskAll] = useState(false);
  const [review, setReview] = useState<ReviewView | null>(null);

  useEffect(() => {
    if (openLog > 0) setAdding(true);
  }, [openLog]);

  async function saveCall() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/calls`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          transcriptMd: form.transcript,
          durationMin: form.duration ? Math.round(parseFloat(form.duration)) : undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        message?: string;
        callId?: string;
      };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else if (d.callId) {
        setStatus("Recorded call saved. Analyze it when you want AI to propose evidence updates.");
        setAdding(false);
        setForm({ title: "", duration: "", transcript: "" });
        router.refresh();
      } else {
        setError("The save response was incomplete. Refresh to check whether the call was stored.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function analyzeCall(call: Call) {
    setAnalyzingCallId(call.id);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/calls/${call.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "analyze" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        callId?: string;
        analysis?: DiscoveryAnalysis;
        recommended?: DiscoveryReviewRecommendation;
        usage?: { model: string; costCents: number };
      };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else if (data.callId && data.analysis && data.recommended) {
        setReview({ callId: data.callId, title: call.title, analysis: data.analysis, recommended: data.recommended });
        setStatus(data.usage ? `Analysis ready with ${data.usage.model} · ≈ $${(data.usage.costCents / 100).toFixed(2)} · review required` : "Analysis ready · review required");
        router.refresh();
      } else {
        setError("The analysis response was incomplete. Refresh to check the call status.");
      }
    } catch {
      setError("Network error — the recorded call is still saved. Try analyzing it again.");
    } finally {
      setAnalyzingCallId(null);
    }
  }

  async function showTranscript(callId: string) {
    if (openTranscript?.id === callId) {
      setOpenTranscript(null);
      return;
    }
    const res = await fetch(`/api/deals/${dealId}/calls/${callId}`);
    const d = (await res.json().catch(() => ({}))) as { transcriptMd?: string };
    setOpenTranscript({ id: callId, text: d.transcriptMd ?? "(transcript unavailable)" });
  }

  async function loadReview(callId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/calls/${callId}`);
      const data = (await res.json().catch(() => ({}))) as { message?: string; review?: ReviewView | null };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else if (data.review) setReview(data.review);
      else setError("This call has no pending AI analysis.");
    } catch {
      setError("Network error — please try again.");
    }
  }

  function openFieldEditor(key: (typeof PACKAGE_FIELDS)[number]) {
    const f = fields[key];
    setEditForm({ status: f?.source ? f.status : null, evidence: f?.evidence ?? "" });
    setFieldError(null);
    setEditing(editing === key ? null : key);
  }

  async function saveField() {
    if (!editing) return;
    if (!editForm.status && !editForm.evidence.trim()) {
      setFieldError("Enter what you learned, or explicitly choose Partial or Missing.");
      return;
    }
    setFieldBusy(true);
    setFieldError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/discovery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: editing, status: manualFieldStatusForSave(editForm.status), evidence: editForm.evidence }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setFieldError(d.message ?? `Failed (${res.status}).`);
      else {
        setEditing(null);
        router.refresh();
      }
    } catch {
      setFieldError("Network error — please try again.");
    } finally {
      setFieldBusy(false);
    }
  }

  const STATUS_OPTIONS: { value: PackageFieldStatus; glyph: string; c: (typeof TONE)[keyof typeof TONE] }[] = [
    { value: "ok", glyph: "✓ ok", c: TONE.green },
    { value: "partial", glyph: "– partial", c: TONE.amber },
    { value: "missing", glyph: "✕ missing", c: TONE.red },
  ];

  const fieldRow = (key: (typeof PACKAGE_FIELDS)[number]) => {
    const f = fields[key];
    const s = f?.status ?? "missing";
    const c = s === "ok" ? TONE.green : s === "partial" ? TONE.amber : TONE.red;
    const isEditing = editing === key;
    const guidance = PACKAGE_FIELD_GUIDANCE[key];
    return (
      <div key={key} style={{ padding: "6px 0" }}>
        <div className="pkg-row" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ width: 16, height: 16, borderRadius: 999, background: c.bg, color: c.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, flex: "none", marginTop: 1 }}>
            {s === "ok" ? "✓" : s === "partial" ? "–" : "✕"}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{PACKAGE_FIELD_LABELS[key]}</span>
              <FieldHelp label={PACKAGE_FIELD_LABELS[key]}>
                <span className="field-help__definitions">
                  <span>{guidance.meaning}</span>
                  <span><b>Why it matters:</b> {guidance.why}</span>
                  <span><b>Ask or listen for:</b> {guidance.ask}</span>
                </span>
              </FieldHelp>
              {canManage && (
                <button
                  onClick={() => openFieldEditor(key)}
                  className="mono pkg-edit"
                  style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 9, fontWeight: 700, cursor: "pointer", padding: 0, opacity: isEditing ? 1 : undefined }}
                >
                  {isEditing ? "close" : "edit"}
                </button>
              )}
            </div>
            {f?.evidence && !isEditing && (
              <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {f.evidence}
                {f.source ? ` · ${f.source}` : ""}
              </div>
            )}
          </div>
        </div>
        {isEditing && (
          <div style={{ margin: "7px 0 2px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setEditForm((v) => ({ ...v, status: o.value }))}
                  className="mono"
                  style={{
                    border: editForm.status === o.value ? `1.5px solid ${o.c.fg}` : "1px solid #d7d9df",
                    background: editForm.status === o.value ? o.c.bg : "var(--white)",
                    color: editForm.status === o.value ? o.c.fg : "var(--muted)",
                    borderRadius: 999,
                    padding: "3px 9px",
                    fontSize: 9.5,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {o.glyph}
                </button>
              ))}
            </div>
            <input
              style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 11.5 }}
              placeholder="What did they say? (evidence)"
              maxLength={500}
              value={editForm.evidence}
              onChange={(e) => setEditForm((v) => ({ ...v, evidence: e.target.value }))}
            />
            {!editForm.status && editForm.evidence.trim() && (
              <p className="mono" style={{ color: "#15803D", fontSize: 9.5, margin: 0 }}>No status selected · Save will mark this OK.</p>
            )}
            {fieldError && <p style={{ color: "#b00020", fontSize: 11, margin: 0 }}>{fieldError}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={saveField}
                disabled={fieldBusy}
                style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
              >
                {fieldBusy ? "Saving…" : editForm.status ? "Save" : "Save as OK"}
              </button>
              <button onClick={() => setEditing(null)} style={{ border: 0, background: "none", color: "var(--muted)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Tactical per-field asks — hidden once the asking window has passed (committed).
  const prompts = stage === "committed" ? [] : nextCallPrompts(fields);
  const shownPrompts = askAll ? prompts : prompts.slice(0, 3);
  const discoveryScore = readiness ?? 0;
  const { readyToDraft, readyToSend } = proposalReadinessFrom(discoveryScore, buyingPath.status);
  const readinessGuidance = !readyToDraft
    ? `Not ready to draft yet. Raise DISCOVERY from ${discoveryScore.toFixed(1)}/10 to at least ${PROPOSAL_READY_AT}/10 by closing the open package fields.`
    : !readyToSend
      ? `Ready to draft. Keep the proposal internal while the Buying path is ${buyingPath.status}; confirm all five buying items before sending.`
      : "Ready to draft and send. The Discovery Package is sufficient and the Buying path is confirmed.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ background: "#FAFBFF", border: "1.5px solid #C9D0FB", borderRadius: 14, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="kicker" style={{ color: "var(--cobalt-text)" }}>Proposal readiness</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: "3px 9px", background: readyToDraft ? TONE.green.bg : TONE.red.bg, color: readyToDraft ? TONE.green.fg : TONE.red.fg }}>
            DRAFT {readyToDraft ? "READY" : "NOT READY"}
          </span>
          <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: "3px 9px", background: readyToSend ? TONE.green.bg : readyToDraft ? TONE.amber.bg : TONE.red.bg, color: readyToSend ? TONE.green.fg : readyToDraft ? TONE.amber.fg : TONE.red.fg }}>
            SEND {readyToSend ? "READY" : "NOT READY"}
          </span>
        </div>
        <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>{readinessGuidance}</p>
        <p className="mono" style={{ margin: "4px 0 0", fontSize: 9.5, color: "var(--muted-line)" }}>Evidence milestones · not a win forecast and never a hard gate</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {/* Discovery package card */}
          <section
            style={{ background: "var(--white)", border: trainingMode ? "1.5px solid var(--cobalt)" : "1px solid var(--border)", borderRadius: 12, padding: 14 }}
          >
        <ProcessSectionHeader
          title="Discovery Package"
          trailing={
            <ReadyPill score={readiness} tone={tone} />
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {DISCOVERY_SCRIPT_GROUPS.map((group, index) => (
            <div key={group.key} style={{ borderTop: index === 0 ? undefined : "1px solid var(--border-softer)", paddingTop: index === 0 ? 2 : 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                <span className="mono" style={{ fontSize: 9, fontWeight: 800, color: "var(--cobalt-text)", textTransform: "uppercase", letterSpacing: ".05em" }}>{group.label}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted-line)" }}>{group.purpose}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", columnGap: 14 }}>
                {group.fields.map(fieldRow)}
              </div>
            </div>
          ))}
        </div>
        {prompts.length > 0 && (
          <div style={{ marginTop: 10, borderTop: "1px solid var(--border-softer)", paddingTop: 9 }}>
            <div className="kicker" style={{ marginBottom: 6 }}>Ask on the next call</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shownPrompts.map((p) => (
                <div key={p.field} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 800, color: p.status === "partial" ? TONE.amber.fg : TONE.red.fg, flex: "none", minWidth: 108 }}>
                    {PACKAGE_FIELD_LABELS[p.field].toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>“{p.prompt}”</span>
                </div>
              ))}
            </div>
            {prompts.length > 3 && (
              <button
                onClick={() => setAskAll((v) => !v)}
                className="mono"
                style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 9.5, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 5 }}
              >
                {askAll ? "show fewer" : `+${prompts.length - 3} more`}
              </button>
            )}
          </div>
        )}
        {trainingMode && (
          <div style={{ marginTop: 10 }}>
            <Explain text={EXPLAIN.whyCompleteness} />
          </div>
        )}
          </section>

          <BuyingPathCard dealId={dealId} path={buyingPath} canManage={canManage} />
        </div>
      </section>

      {/* Next best action (training mode only) */}
      {trainingMode && nextActions.length > 0 && (
        <section style={{ background: "var(--ink)", borderRadius: 12, padding: "14px 15px" }}>
          <div className="kicker" style={{ color: "#8b909a", marginBottom: 10 }}>Next best action</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {nextActions.map((a) => (
              <div key={a.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  className="mono"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: a.active ? "var(--cobalt)" : "#2c2f36",
                    color: a.active ? "var(--white)" : "#8b909a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    flex: "none",
                    marginTop: 1,
                  }}
                >
                  {a.n}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: a.active ? "var(--white)" : "#8b909a", fontWeight: a.active ? 600 : 500 }}>
                  {a.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recorded calls (the past — "Log = past") */}
      <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="kicker">Recorded calls ({calls.length})</span>
          {canManage && (
            <button
              onClick={() => setAdding((v) => !v)}
              style={{ marginLeft: "auto", border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {adding ? "cancel" : "+ log a call"}
            </button>
          )}
        </div>
        {review && <DiscoveryReviewCard key={review.callId} dealId={dealId} review={review} onDone={() => setReview(null)} />}
        {adding && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 7 }}>
              <input
                style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, flex: 1 }}
                placeholder="Source title (e.g. Discovery call 2)"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <input
                className="mono"
                style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, width: 74 }}
                placeholder="min"
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value.replace(/[^0-9]/g, "") }))}
              />
            </div>
            <textarea
              style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12, minHeight: 90, fontFamily: "inherit", lineHeight: 1.45 }}
              placeholder="Paste a transcript or meeting notes. Save it first; AI analysis is a separate action."
              value={form.transcript}
              onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
            />
            <button
              onClick={saveCall}
              disabled={busy || !form.title.trim() || !form.transcript.trim()}
              style={{ alignSelf: "flex-start", background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              {busy ? "Saving…" : "Save recorded call"}
            </button>
            <p className="mono" style={{ margin: 0, fontSize: 9.5, color: "var(--muted-line)" }}>Saving does not run AI or change Discovery Package evidence.</p>
          </div>
        )}
        {status && <p style={{ color: "#15803d", fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>{status}</p>}
        {error && <p style={{ color: "#b00020", fontSize: 12, margin: "0 0 8px" }}>{error}</p>}
        {calls.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-line)" }}>No calls yet — save the first transcript, then analyze it when you are ready to review evidence.</p>
        ) : (
          calls.map((c) => (
            <div key={c.id} style={{ borderBottom: "1px solid var(--border-softer)", padding: "7px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.reviewStatus === "not_analyzed" ? "#64748B" : c.reviewStatus === "pending" ? "#D97706" : c.reviewStatus === "dismissed" ? "#9AA0AA" : "#16A34A", flex: "none" }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", flex: "none" }}>
                  {new Date(c.recordedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  {c.durationMin ? ` · ${Math.floor(c.durationMin / 60) > 0 ? `${Math.floor(c.durationMin / 60)}h` : ""}${c.durationMin % 60}m` : ""}
                  {c.reviewStatus === "not_analyzed" ? " · saved · not analyzed" : c.reviewStatus === "pending" ? " · review pending" : c.reviewStatus === "dismissed" ? " · analysis dismissed" : ` · ${c.fieldsExtracted} fields accepted`}
                </span>
                {canManage && c.reviewStatus === "not_analyzed" && (
                  <button
                    onClick={() => void analyzeCall(c)}
                    disabled={analyzingCallId !== null}
                    className="mono"
                    style={{
                      border: 0,
                      background: "var(--ink)",
                      color: "var(--white)",
                      borderRadius: 999,
                      padding: "5px 9px",
                      fontSize: 9.5,
                      fontWeight: 800,
                      lineHeight: 1,
                      cursor: analyzingCallId !== null ? "wait" : "pointer",
                      opacity: analyzingCallId !== null ? 0.7 : 1,
                      flex: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {analyzingCallId === c.id ? "Analyzing (~20s)…" : "◆ Analyze with AI"}
                  </button>
                )}
                {c.reviewStatus === "pending" && (
                  <button onClick={() => loadReview(c.id)} className="mono" style={{ border: 0, background: "none", color: "#B45309", fontSize: 10, fontWeight: 800, cursor: "pointer", flex: "none" }}>
                    review →
                  </button>
                )}
                <button onClick={() => showTranscript(c.id)} className="mono" style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 10, fontWeight: 700, cursor: "pointer", flex: "none" }}>
                  {openTranscript?.id === c.id ? "hide" : "transcript →"}
                </button>
              </div>
              {openTranscript?.id === c.id && (
                <pre className="mono" style={{ margin: "8px 0 2px", fontSize: 10.5, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "#FBFBFC", border: "1px solid #EDEDF1", borderRadius: 8, padding: "9px 11px", maxHeight: 260, overflowY: "auto" }}>
                  {openTranscript.text}
                </pre>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/** Explain callout for the stage chip area (training mode) / tooltip source (off). */
export function StagesVsGatesCallout() {
  return <Explain text={EXPLAIN.stagesVsGates} />;
}
