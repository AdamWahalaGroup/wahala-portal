/**
 * Process model (TRAINING-AND-SCORECARD.md) — pure logic, no DB.
 *
 * The ONE idea: guidance and measurement are the same feature. This module knows,
 * for any deal, what should happen next (given its stage, gates passed,
 * time elapsed, and Discovery Package completeness). Pointed forward it GUIDES
 * (training mode, frame 38); pointed at elapsed history it MEASURES (nudges,
 * post-mortems frame 40, scorecard frame 41). Build the model once; render it
 * three ways.
 *
 * Non-negotiable: stages are dispositions — the portal NEVER blocks a
 * move. Only gates block. Every guidance surface can be overridden; overrides
 * are logged, never prevented.
 */
// Relative imports so any future worker bundle can resolve this chain.
import { PACKAGE_FIELDS } from "../db/schema";
import type { DealStage } from "./sales";

export type PackageFieldKey = (typeof PACKAGE_FIELDS)[number];
export type PackageFieldStatus = "ok" | "partial" | "missing";
export type PackageField = { status: PackageFieldStatus; evidence?: string | null; source?: string | null };
export type PackageFields = Partial<Record<PackageFieldKey, PackageField>>;

export const PACKAGE_FIELD_LABELS: Record<PackageFieldKey, string> = {
  business_profile: "Business profile",
  current_workflow: "Current workflow",
  pain_points: "Pain points",
  budget_posture: "Budget posture",
  decision_makers: "Decision makers",
  success_metrics: "Success metrics",
  mvp_priorities: "MVP priorities",
  timeline: "Timeline",
  customer_terminology: "Customer terminology",
  deferred_scope: "Deferred scope",
};

/** Readiness 0–10 (one decimal) from package completeness: ok=1, partial=½, missing=0. */
export function readinessFrom(fields: PackageFields): number {
  let sum = 0;
  for (const key of PACKAGE_FIELDS) {
    const s = fields[key]?.status;
    if (s === "ok") sum += 1;
    else if (s === "partial") sum += 0.5;
  }
  return Math.round((sum / PACKAGE_FIELDS.length) * 100) / 10;
}

export const PROPOSAL_READY_AT = 7;

export type ReadinessTone = "green" | "amber" | "red";
export function readinessTone(score: number): ReadinessTone {
  return score >= 7 ? "green" : score >= 4 ? "amber" : "red";
}

/** Fields that fail the proposal-ready check, for the frame-39 nudge body. */
export function failedChecks(fields: PackageFields): { field: PackageFieldKey; label: string; status: PackageFieldStatus; evidence: string | null }[] {
  return PACKAGE_FIELDS.filter((k) => (fields[k]?.status ?? "missing") !== "ok").map((k) => ({
    field: k,
    label: PACKAGE_FIELD_LABELS[k],
    status: fields[k]?.status ?? "missing",
    evidence: fields[k]?.evidence ?? null,
  }));
}

/**
 * Manual edit of one package field — unlike the AI ingest merge (which never
 * downgrades), a human MAY downgrade a field they know is wrong. Source is
 * forced to "manual" so the UI can show where the fact came from. Non-mutating.
 * A later AI ingest can re-raise a manually-downgraded field (rank-based merge);
 * that's intended — new evidence beats an old correction.
 */
export function applyManualField(
  fields: PackageFields,
  key: PackageFieldKey,
  input: { status: PackageFieldStatus; evidence?: string | null },
): { fields: PackageFields; readiness: number } {
  const evidence = input.evidence?.trim() || null;
  const next: PackageFields = { ...fields, [key]: { status: input.status, evidence, source: "manual" } };
  return { fields: next, readiness: readinessFrom(next) };
}

// ---------------------------------------------------------------- next-call prompts
// One concrete ask per package field — the tactical companion to the strategic
// "next best action" card. Derived, no AI call; a missing field IS the question.

export const ASK_PROMPTS: Record<PackageFieldKey, string> = {
  business_profile: "What does the business actually do, in their words?",
  current_workflow: "Walk me through how this works today, step by step.",
  pain_points: "Where does today's process hurt the most?",
  budget_posture: "What budget range are you working within for this?",
  decision_makers: "Who signs off — can they join the next call?",
  success_metrics: "What number tells you this worked?",
  mvp_priorities: "If we could only ship one thing first, what is it?",
  timeline: "When does this need to be live, and what's driving that date?",
  customer_terminology: "What do you call these things internally?",
  deferred_scope: "What are we explicitly NOT doing in round one?",
};

export function nextCallPrompts(fields: PackageFields): { field: PackageFieldKey; label: string; status: PackageFieldStatus; prompt: string }[] {
  return failedChecks(fields).map((f) => ({ field: f.field, label: f.label, status: f.status, prompt: ASK_PROMPTS[f.field] }));
}

// ---------------------------------------------------------------- explain copy
// Source of truth = the glossary in docs/brain_storming/synthesis.md. Render the
// SAME strings everywhere (callouts in training mode, tooltips when it's off).

export const EXPLAIN = {
  stagesVsGates:
    "Stages are dispositions — move a deal wherever it actually is, the portal never blocks a stage move. Gates are different: hard invariants like no payment before contract and no engineering before contract. Stages report; gates enforce.",
  whyCompleteness:
    "A proposal written on a thin Discovery Package is a guess — that's how “we said it would take two days” happens. Completeness isn't paperwork; it's what makes the fixed price and the timeline survivable.",
} as const;

// ---------------------------------------------------------------- goal rail (frame 38)

/** The 6-step journey the goal rail tracks (Triage counts as step 1). */
export const JOURNEY: { key: string; label: string }[] = [
  { key: "captured", label: "captured" },
  { key: "discovery", label: "discovery" },
  { key: "proposal_out", label: "proposal out" },
  { key: "negotiating", label: "negotiating" },
  { key: "committed", label: "committed" },
  { key: "won", label: "won" },
];

export function journeyIndex(stage: DealStage): number {
  const map: Record<DealStage, number> = { new: 0, discovery: 1, proposal_out: 2, negotiating: 3, committed: 4, won: 5, lost: 1 };
  return map[stage];
}

/** The current goal sentence — the next expected milestone, derived, never hand-set. */
export function goalFor(stage: DealStage, readiness: number | null, daysInStage: number): string {
  switch (stage) {
    case "new":
      return "Accept the opportunity into Discovery to start the deal — or decline it.";
    case "discovery":
      return readiness !== null && readiness >= PROPOSAL_READY_AT
        ? "The package is proposal-ready — draft Option A / Option B."
        : `Fill the Discovery Package to proposal-ready (${PROPOSAL_READY_AT}/10) — then draft the proposal.`;
    case "proposal_out":
      return daysInStage >= 5 ? "Follow up on the proposal — the at-risk clock is running." : "Get the proposal read — chase a real yes/no, not silence.";
    case "negotiating":
      return "Close the open terms — get to a verbal yes with terms named.";
    case "committed":
      return "Complete the agreement package and collect the deposit — then create the project.";
    case "won":
      return "Handed off — the project carries it from here.";
    case "lost":
      return "Closed lost — read the post-mortem.";
  }
}

// ---------------------------------------------------------------- next best actions (frame 38)

export type NextAction = { n: number; text: string; active: boolean };

export function nextBestActions(input: {
  stage: DealStage;
  readiness: number | null;
  hasDiscoveryMd: boolean;
  proposalStatus: "none" | "draft" | "sent" | "approved";
  complexityScore: number | null;
  depositPaid: boolean;
}): NextAction[] {
  const { stage, readiness, hasDiscoveryMd, proposalStatus, complexityScore, depositPaid } = input;
  const list = (items: [string, boolean][]): NextAction[] => items.map(([text, active], i) => ({ n: i + 1, text, active }));

  if (stage === "discovery") {
    const ready = (readiness ?? 0) >= PROPOSAL_READY_AT;
    if (!ready) {
      return list([
        ["Record the next call (or paste its transcript) — the package fills itself.", true],
        ["Close the open package fields: name the decision maker, get a budget posture.", false],
        [`At ${PROPOSAL_READY_AT}/10 readiness, draft Option A / Option B.`, false],
      ]);
    }
    return list([
      ["Draft the proposal — always Option A / Option B.", proposalStatus === "none"],
      ["Complexity > 3.0 goes to engineering for hardcore review before send.", proposalStatus === "draft" && (complexityScore ?? 0) > 3],
      ["Price both options (human, never AI) and send — no deposit at approval.", proposalStatus === "draft" && (complexityScore ?? 0) <= 3],
    ]);
  }
  if (stage === "proposal_out") {
    return list([
      ["Follow up before the at-risk clock flags it — silence is a decision too.", proposalStatus === "sent"],
      ["Get a real answer: approve, decline, or a named objection to negotiate.", false],
      ["On approval the deal moves to Committed automatically.", false],
    ]);
  }
  if (stage === "negotiating") {
    return list([
      ["Name the open terms — redlines with counsel or verbal yes · terms open.", true],
      ["Keep the substatus current; it shows on the board card.", false],
      ["Terms closed → Committed, where the agreement package seeds itself.", false],
    ]);
  }
  if (stage === "committed") {
    return list([
      [depositPaid ? "Deposit cleared — Create project →." : "Send the deposit invoice and chase it — it gates the project.", true],
      ["Complete the agreement package (MSA once per account — the fast lane).", false],
      ["Create project → Stage 1 opens paid; invite the client to the portal.", false],
    ]);
  }
  return [];
}

// ---------------------------------------------------------------- expectations (frame 40)

export type ProcessExpectation = { key: string; text: string };

/** What the model EXPECTED — post-mortem divergence lines come from these. */
export const EXPECTATIONS: ProcessExpectation[] = [
  { key: "decision_maker_before_proposal", text: "decision maker identified before the proposal goes out" },
  { key: "readiness_at_advance", text: `readiness ≥ ${PROPOSAL_READY_AT}/10 when advancing to Proposal out` },
  { key: "followup_after_send", text: "follow-up within 5 days of sending the proposal" },
  { key: "no_ignored_nudges", text: "nudges acted on, not overridden without cause" },
];

export const FOLLOWUP_EXPECTED_DAYS = 5;
