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
import type { BudgetStatus } from "./deal-operating-model";

/** Evidence needed to responsibly describe, scope, and price the work. */
export const SOLUTION_CLARITY_FIELDS = [
  "business_profile",
  "current_workflow",
  "pain_points",
  "success_metrics",
  "mvp_priorities",
  "timeline",
  "customer_terminology",
  "deferred_scope",
] as const;

/** Retained in stored JSON/API types so historical reviews remain readable. */
export const LEGACY_BUYING_PACKAGE_FIELDS = ["budget_posture", "decision_makers"] as const;
export const PACKAGE_FIELDS = [...SOLUTION_CLARITY_FIELDS, ...LEGACY_BUYING_PACKAGE_FIELDS] as const;

export type PackageFieldKey = (typeof PACKAGE_FIELDS)[number];
export type SolutionClarityFieldKey = (typeof SOLUTION_CLARITY_FIELDS)[number];
export type PackageFieldStatus = "ok" | "partial" | "missing";
export type PackageField = { status: PackageFieldStatus; evidence?: string | null; source?: string | null };
export type BuyingPathEvidenceFields = Partial<Record<BuyingPathFieldKey, PackageField>>;
export type PackageFields = Partial<Record<PackageFieldKey, PackageField>> & { buyingPath?: BuyingPathEvidenceFields };

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

export type DiscoveryScriptGroup = {
  key: string;
  label: string;
  purpose: string;
  fields: readonly PackageFieldKey[];
};

/**
 * Progressive call flow for a developing seller. Budget comes after the seller
 * has earned the right to discuss money by understanding pain and desired value.
 */
export const DISCOVERY_SCRIPT_GROUPS = [
  {
    key: "business_context",
    label: "1 · Business context",
    purpose: "Learn who they are and how the requested outcome fits the business.",
    fields: ["business_profile"],
  },
  {
    key: "current_reality",
    label: "2 · Current reality",
    purpose: "Follow the real workflow before discussing solutions.",
    fields: ["current_workflow", "pain_points", "customer_terminology"],
  },
  {
    key: "desired_outcome",
    label: "3 · Desired outcome & first scope",
    purpose: "Define success, the smallest valuable delivery, and its boundary.",
    fields: ["success_metrics", "mvp_priorities", "deferred_scope"],
  },
  {
    key: "delivery_timing",
    label: "4 · Delivery timing",
    purpose: "Capture the desired delivery dates, dependencies, and practical constraints.",
    fields: ["timeline"],
  },
] as const satisfies readonly DiscoveryScriptGroup[];

export const DISCOVERY_SCRIPT_FIELDS = DISCOVERY_SCRIPT_GROUPS.flatMap((group) => [...group.fields]) as SolutionClarityFieldKey[];

/** Discovery completeness 0–10 (one decimal): ok=1, partial=½, missing=0. */
export function readinessFrom(fields: PackageFields): number {
  let sum = 0;
  for (const key of SOLUTION_CLARITY_FIELDS) {
    const s = fields[key]?.status;
    if (s === "ok") sum += 1;
    else if (s === "partial") sum += 0.5;
  }
  return Math.round((sum / SOLUTION_CLARITY_FIELDS.length) * 100) / 10;
}

export const PROPOSAL_READY_AT = 7;

/** Separate evidence milestones: buying evidence can never compensate for thin discovery. */
export function proposalReadinessFrom(discoveryScore: number, buyingPathStatus: BuyingPathStatus): { readyToDraft: boolean; readyToSend: boolean } {
  const readyToDraft = discoveryScore >= PROPOSAL_READY_AT;
  return { readyToDraft, readyToSend: readyToDraft && buyingPathStatus === "confirmed" };
}

export type ReadinessTone = "green" | "amber" | "red";
export function readinessTone(score: number): ReadinessTone {
  return score >= 7 ? "green" : score >= 4 ? "amber" : "red";
}

/** Solution fields that still need evidence, used by call coaching and send nudges. */
export function failedChecks(fields: PackageFields): { field: PackageFieldKey; label: string; status: PackageFieldStatus; evidence: string | null }[] {
  return DISCOVERY_SCRIPT_FIELDS.filter((k) => (fields[k]?.status ?? "missing") !== "ok").map((k) => ({
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

/**
 * Typing evidence is the normal happy path: when an admin does not deliberately
 * choose Partial or Missing, saving means they consider the answer complete.
 */
export function manualFieldStatusForSave(selected: PackageFieldStatus | null): PackageFieldStatus {
  return selected ?? "ok";
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

// ---------------------------------------------------------------- buying path

export const BUYING_PATH_FIELDS = ["champion", "economicBuyer", "compellingEvent", "decisionProcess", "budget"] as const;
export type BuyingPathFieldKey = (typeof BUYING_PATH_FIELDS)[number];
export type BuyingPathStatus = "unverified" | "developing" | "confirmed";

export const BUYING_PATH_LABELS: Record<BuyingPathFieldKey, string> = {
  champion: "Champion",
  economicBuyer: "Economic buyer",
  compellingEvent: "Compelling event",
  decisionProcess: "Decision process",
  budget: "Funding path",
};

export const BUYING_PATH_PROMPTS: Record<BuyingPathFieldKey, string> = {
  champion: "Who inside the customer will actively help this purchase move?",
  economicBuyer: "Who can authorize the money and final commercial decision?",
  compellingEvent: "Why must they act now, and what happens if they do nothing?",
  decisionProcess: "Who evaluates, approves, signs, and what steps happen before a yes?",
  budget: "How will this be funded, and what concrete evidence supports that path?",
};

export const BUYING_PATH_GUIDANCE: Record<BuyingPathFieldKey, PackageFieldGuidance> = {
  champion: {
    meaning: "The person inside the customer who believes in the work and will actively help it move when Wahala is not in the room.",
    why: "Interest from a friendly contact is not enough; a champion spends credibility and helps navigate the organization.",
    ask: BUYING_PATH_PROMPTS.champion,
  },
  economicBuyer: {
    meaning: "The person who can authorize the money and accept the final commercial decision, even if someone else signs the paperwork.",
    why: "A proposal can stall indefinitely when it never reaches the person accountable for the spend.",
    ask: BUYING_PATH_PROMPTS.economicBuyer,
  },
  compellingEvent: {
    meaning: "A customer-owned reason to act by a real date, including the consequence if the customer does nothing.",
    why: "Without a meaningful event or consequence, a useful project can remain optional forever.",
    ask: BUYING_PATH_PROMPTS.compellingEvent,
  },
  decisionProcess: {
    meaning: "The actual path from evaluation through approval, legal or procurement review, signature, and a final yes.",
    why: "Knowing the steps and participants prevents surprise approvals and makes the close plan concrete.",
    ask: BUYING_PATH_PROMPTS.decisionProcess,
  },
  budget: {
    meaning: "The source of funds, its current approval state, and concrete evidence that the proposed work can be paid for.",
    why: "Enthusiasm and authority do not guarantee that usable funds exist or can be released.",
    ask: BUYING_PATH_PROMPTS.budget,
  },
};

export type BuyingPathInput = {
  champion: string | null;
  economicBuyer: string | null;
  compellingEvent: string | null;
  decisionProcess: string | null;
  budgetStatus: BudgetStatus;
  budgetEvidence: string | null;
};

export type BuyingPath = BuyingPathInput & {
  status: BuyingPathStatus;
  completed: number;
  total: number;
  missing: BuyingPathFieldKey[];
  fields: BuyingPathEvidenceFields;
};

export function buyingPathFrom(input: BuyingPathInput, stored: BuyingPathEvidenceFields = {}): BuyingPath {
  const canonicalEvidence: Record<BuyingPathFieldKey, string | null> = {
    champion: input.champion?.trim() || null,
    economicBuyer: input.economicBuyer?.trim() || null,
    compellingEvent: input.compellingEvent?.trim() || null,
    decisionProcess: input.decisionProcess?.trim() || null,
    budget: input.budgetEvidence?.trim() || null,
  };
  const derivedComplete: Record<BuyingPathFieldKey, boolean> = {
    champion: !!canonicalEvidence.champion,
    economicBuyer: !!canonicalEvidence.economicBuyer,
    compellingEvent: !!canonicalEvidence.compellingEvent,
    decisionProcess: !!canonicalEvidence.decisionProcess,
    budget: (input.budgetStatus === "funding_path" || input.budgetStatus === "confirmed") && !!canonicalEvidence.budget,
  };
  const fields = Object.fromEntries(BUYING_PATH_FIELDS.map((key) => {
    const saved = stored[key];
    return [key, {
      status: saved?.status ?? (derivedComplete[key] ? "ok" : "missing"),
      evidence: saved?.evidence ?? canonicalEvidence[key],
      source: saved?.source ?? (canonicalEvidence[key] ? "existing deal" : null),
    } satisfies PackageField];
  })) as Record<BuyingPathFieldKey, PackageField>;
  const completed = BUYING_PATH_FIELDS.filter((key) => fields[key].status === "ok").length;
  const hasEvidence = BUYING_PATH_FIELDS.some((key) => fields[key].status !== "missing" || !!fields[key].evidence?.trim());
  const status: BuyingPathStatus = completed === BUYING_PATH_FIELDS.length
    ? "confirmed"
    : !hasEvidence
      ? "unverified"
      : "developing";
  return {
    ...input,
    status,
    completed,
    total: BUYING_PATH_FIELDS.length,
    missing: BUYING_PATH_FIELDS.filter((key) => fields[key].status !== "ok"),
    fields,
  };
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
export function goalFor(stage: DealStage, readiness: number | null, daysInStage: number, buyingPathStatus: BuyingPathStatus = "unverified"): string {
  switch (stage) {
    case "new":
      return "Accept the opportunity into Discovery to start the deal — or decline it.";
    case "discovery":
      return readiness !== null && readiness >= PROPOSAL_READY_AT
        ? buyingPathStatus === "confirmed"
          ? "The Discovery Package and buying path are established — draft and prepare the proposal."
          : "Discovery is sufficient to draft — rough out the proposal, then confirm the buying path before sending."
        : `Build the Discovery Package to ${PROPOSAL_READY_AT}/10 — then rough out the proposal.`;
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
  buyingPathStatus?: BuyingPathStatus;
}): NextAction[] {
  const { stage, readiness, proposalStatus, complexityScore, depositPaid, buyingPathStatus = "unverified" } = input;
  const list = (items: [string, boolean][]): NextAction[] => items.map(([text, active], i) => ({ n: i + 1, text, active }));

  if (stage === "discovery") {
    const ready = (readiness ?? 0) >= PROPOSAL_READY_AT;
    if (!ready) {
      return list([
        ["Record the next call (or paste its transcript), then review the evidence AI proposes.", true],
        ["Close the open Discovery Package gaps: workflow, pain, outcome, first scope, boundaries, and delivery timing.", false],
        [`At DISCOVERY ${PROPOSAL_READY_AT}/10, rough out the proposal.`, false],
      ]);
    }
    return list([
      ["Draft the recommended proposal path; add another option only for a real customer tradeoff.", proposalStatus === "none"],
      ["Confirm the buying path before send: economic buyer, decision process, compelling event, and funding evidence.", proposalStatus === "draft" && buyingPathStatus !== "confirmed"],
      ["Complexity > 3.0 goes to engineering for hardcore review before send.", proposalStatus === "draft" && (complexityScore ?? 0) > 3],
      ["Set the price (human, never AI); send when the buying path is confirmed.", proposalStatus === "draft" && (complexityScore ?? 0) <= 3 && buyingPathStatus === "confirmed"],
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
  { key: "buying_path_before_proposal", text: "buying path confirmed before the proposal goes out" },
  { key: "readiness_at_advance", text: `Discovery Package ≥ ${PROPOSAL_READY_AT}/10 when advancing to Proposal out` },
  { key: "followup_after_send", text: "follow-up within 5 days of sending the proposal" },
  { key: "no_ignored_nudges", text: "nudges acted on, not overridden without cause" },
];

export const FOLLOWUP_EXPECTED_DAYS = 5;
