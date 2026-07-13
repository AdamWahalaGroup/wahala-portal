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
import type { DealStage } from "./sales";

export const PACKAGE_FIELDS = [
  "business_profile",
  "current_workflow",
  "pain_points",
  "budget_posture",
  "decision_makers",
  "success_metrics",
  "mvp_priorities",
  "timeline",
  "customer_terminology",
  "deferred_scope",
] as const;

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

export type PackageFieldGuidance = {
  meaning: string;
  why: string;
  ask: string;
};

/** Call coaching for each readiness field; evidence, not checkbox completion, is the goal. */
export const PACKAGE_FIELD_GUIDANCE: Record<PackageFieldKey, PackageFieldGuidance> = {
  business_profile: {
    meaning: "How the customer operates: what they sell or provide, to whom, at what scale, and under which important constraints.",
    why: "Scope and pricing must fit the real business, not just the requested feature.",
    ask: "What does the business actually do, for whom, and at what scale?",
  },
  current_workflow: {
    meaning: "The real end-to-end process today, including people, tools, handoffs, volumes, and common exceptions.",
    why: "This exposes the actual work, integrations, and change-management effort the solution must support.",
    ask: "Walk me through one real case from beginning to end. Who does what, using which tools?",
  },
  pain_points: {
    meaning: "Specific failures or friction in the current workflow and their measurable business consequences—not a feature wish list.",
    why: "Pain and impact explain why the buyer should act and which problems are worth paying to solve.",
    ask: "Where does the process break down most often, and what does that cost in time, money, risk, or lost work?",
  },
  budget_posture: {
    meaning: "Evidence of available funds, a credible funding path, spending authority, and any working range—not enthusiasm alone.",
    why: "A responsible proposal needs a buying path as well as a technical need.",
    ask: "How will this be funded, who approves the spend, and what range are you prepared to evaluate?",
  },
  decision_makers: {
    meaning: "The people and roles that evaluate, approve, sign, influence, or can block the purchase.",
    why: "Wahala needs the right people involved before investing in a proposal that cannot be approved.",
    ask: "Who evaluates the solution, who approves the money, who signs, and who else must be comfortable?",
  },
  success_metrics: {
    meaning: "Observable outcomes with a baseline, target, or acceptance test the customer will use to judge success.",
    why: "Success evidence anchors value, scope, acceptance, and later delivery decisions.",
    ask: "What must measurably improve for you to call this successful, and how will you verify it?",
  },
  mvp_priorities: {
    meaning: "The smallest coherent first outcome, with must-haves separated from useful later capabilities.",
    why: "Clear priority makes a first phase or one-shot delivery scopeable without promising everything at once.",
    ask: "If the first release could accomplish only one valuable outcome, what must it be? What can wait?",
  },
  timeline: {
    meaning: "Buyer-supported decision, delivery, or go-live dates plus the event, dependency, or consequence driving them.",
    why: "A date without a business driver is usually a hope; the driver reveals urgency and schedule risk.",
    ask: "When must a decision and go-live happen, what drives those dates, and what happens if they slip?",
  },
  customer_terminology: {
    meaning: "The customer’s own names for roles, records, workflow steps, outputs, and important industry concepts.",
    why: "Using their language prevents misunderstandings and makes proposals and requirements easier for them to validate.",
    ask: "What do your team and customers call these people, records, steps, and outputs?",
  },
  deferred_scope: {
    meaning: "Capabilities, users, data, integrations, and responsibilities explicitly excluded from the first delivery or saved for later.",
    why: "A clear boundary prevents accidental promises and makes phased pricing credible.",
    ask: "What are we deliberately not doing in the first delivery, and which items belong in a later phase?",
  },
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

export const ASK_PROMPTS = Object.fromEntries(
  PACKAGE_FIELDS.map((key) => [key, PACKAGE_FIELD_GUIDANCE[key].ask]),
) as Record<PackageFieldKey, string>;

export function nextCallPrompts(fields: PackageFields): { field: PackageFieldKey; label: string; status: PackageFieldStatus; prompt: string }[] {
  return failedChecks(fields).map((f) => ({ field: f.field, label: f.label, status: f.status, prompt: ASK_PROMPTS[f.field] }));
}

// ---------------------------------------------------------------- explain copy
// Source of truth = docs/SALES-PROCESS.md. Shared by the stage and training
// explanation surfaces; field-specific call coaching lives above.

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
  { key: "committed", label: "contracting" },
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
  const { stage, readiness, proposalStatus, complexityScore, depositPaid } = input;
  const list = (items: [string, boolean][]): NextAction[] => items.map(([text, active], i) => ({ n: i + 1, text, active }));

  if (stage === "discovery") {
    const ready = (readiness ?? 0) >= PROPOSAL_READY_AT;
    if (!ready) {
      return list([
        ["Record the next call (or paste its transcript), then review the evidence AI proposes.", true],
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
      ["On approval the deal moves to Contracting automatically.", false],
    ]);
  }
  if (stage === "negotiating") {
    return list([
      ["Name the open terms — redlines with counsel or verbal yes · terms open.", true],
      ["Keep the substatus current; it shows on the board card.", false],
      ["Terms closed → Contracting, where the agreement package seeds itself.", false],
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
