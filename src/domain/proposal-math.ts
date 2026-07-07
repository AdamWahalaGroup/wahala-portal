/**
 * Proposal math (HANDOFF-DELTA-2026-07-07) — the interactive prototype's
 * deterministic logic, verbatim semantics, in CENTS. Pure: no DB, no AI.
 * Humans + this math own every number; the AI only ever writes prose.
 *
 * Prototype constants ×100: $500 grain → 50_000¢; $3,000/week → 300_000¢;
 * $50,000 complexity step → 5_000_000¢.
 */
import type { Approver, ContractPhase, PhaseStatus, ProposalContract, ProposalPhase } from "./proposal-doc";

export type PathCount = "1" | "2" | "3";

export type OptionShape = {
  label: string;
  name: string;
  priceCents: number;
  timelineNote: string;
  recommended: false;
  phases: ProposalPhase[] | null; // null = lump-sum
};

/** Complexity default from deal size: $35k → 1 … $225k → 5. Admin-adjustable after. */
export function defaultComplexity(valueCents: number): number {
  return Math.min(5, Math.max(1, Math.round(valueCents / 5_000_000) + 1));
}

export function defaultComplexityRationale(complexity: number): string {
  return complexity > 3 ? "Larger build — worth an engineering look before this goes out." : "";
}

/** Split a total into n phases on a $500 grain; the last phase absorbs the remainder. */
export function mkPhases(totalCents: number, n: number): ProposalPhase[] {
  const per = Math.max(50_000, Math.round(totalCents / n / 50_000) * 50_000);
  return Array.from({ length: n }, (_, i) => ({
    name: `Phase ${i + 1}`,
    amountCents: i === n - 1 ? totalCents - per * (n - 1) : per,
    weeks: Math.max(2, Math.round(per / 300_000)),
    status: "awaiting_amendment" as PhaseStatus,
  }));
}

const lumpTimeline = (valueCents: number) => `~${Math.max(3, Math.round(valueCents / 300_000))} weeks · one delivery`;

/** The setup modal's option shapes per path-count choice. Never marks anything recommended. */
export function buildOptionShapes(pathCount: PathCount, valueCents: number): OptionShape[] {
  if (pathCount === "1") {
    return [
      {
        label: "A",
        name: "Recommended scope",
        priceCents: valueCents,
        timelineNote: "phased · confirmed as we reach each stage",
        recommended: false,
        phases: mkPhases(valueCents, 2),
      },
    ];
  }
  if (pathCount === "3") {
    const better = Math.round((valueCents * 1.3) / 50_000) * 50_000;
    const best = Math.round((valueCents * 1.7) / 50_000) * 50_000;
    return [
      { label: "A", name: "Good — core scope", priceCents: valueCents, timelineNote: lumpTimeline(valueCents), recommended: false, phases: null },
      { label: "B", name: "Better — phased buildout", priceCents: better, timelineNote: "phased · each stage confirmed as we reach it", recommended: false, phases: mkPhases(better, 2) },
      { label: "C", name: "Best — full scope", priceCents: best, timelineNote: "phased · broadest coverage", recommended: false, phases: mkPhases(best, 3) },
    ];
  }
  return [
    { label: "A", name: "Standard rollout", priceCents: valueCents, timelineNote: lumpTimeline(valueCents), recommended: false, phases: null },
    { label: "B", name: "Phased buildout", priceCents: valueCents, timelineNote: "phased · each phase confirmed as we reach it", recommended: false, phases: mkPhases(valueCents, 2) },
  ];
}

/** Deterministic exec summary — the AI usually overwrites this; it's the no-AI fallback. */
export function fallbackExecSummary(input: { discoveryNote: string | null; dealName: string; pathCount: PathCount; note?: string | null }): string {
  const base = input.discoveryNote?.trim() || `${input.dealName} — recommended approach based on what discovery has captured so far.`;
  const shapeNote =
    input.pathCount === "1"
      ? " We've scoped one recommended path rather than a menu of choices."
      : input.pathCount === "3"
        ? " Laid out as three tiers so you can size up or down without a rewrite."
        : " Two paths below — a straight delivery and a phased one, so you can pick the risk level that fits.";
  const note = input.note?.trim();
  const weighted = note ? ` Weighing ${note.charAt(0).toLowerCase()}${note.slice(1).replace(/\.$/, "")} in how this is laid out.` : "";
  return base + shapeNote + weighted;
}

// ---------------------------------------------------------------- options

type OptionLike = { id: string; priceCents: number; recommended?: boolean; phases?: ProposalPhase[] | null; name: string };

/** The contract's source option: what the client chose, else the recommendation, else A. */
export function chooseContractSourceOption<T extends OptionLike>(options: T[], selectedOptionId: string | null): T | undefined {
  return options.find((o) => o.id === selectedOptionId) ?? options.find((o) => o.recommended) ?? options[0];
}

/** Phases of an option; a lump-sum option becomes one pseudo-phase. */
export function sourcePhasesFor(option: OptionLike): { name: string; amountCents: number; weeks: number | null; internalNote?: string }[] {
  return option.phases?.length
    ? option.phases.map((p) => ({ name: p.name, amountCents: p.amountCents, weeks: p.weeks, internalNote: p.internalNote }))
    : [{ name: option.name, amountCents: option.priceCents, weeks: null }];
}

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** First unused letter A–H, or null when all 8 are taken. */
export function nextOptionLabel(usedLabels: string[]): string | null {
  return LABELS.find((l) => !usedLabels.includes(l)) ?? null;
}

// ---------------------------------------------------------------- amendments

/** Phase i can be activated only after the previous phase is active/done. Never phase 0. */
export function canAmendPhase(phases: ProposalPhase[], i: number): boolean {
  if (i <= 0 || i >= phases.length) return false;
  if (phases[i].status !== "awaiting_amendment") return false;
  return phases[i - 1].status === "active" || phases[i - 1].status === "done";
}

// ---------------------------------------------------------------- contract snapshot

function contractPhaseFrom(src: { name: string; amountCents: number; weeks: number | null; internalNote?: string }, lump: boolean): ContractPhase {
  const note = src.internalNote?.trim();
  return {
    name: src.name,
    amountCents: src.amountCents,
    weeks: src.weeks,
    objective: note || `Deliver ${src.name} as scoped in this engagement.`,
    scopeText: lump
      ? "Design and implement the agreed scope.\nTesting and quality assurance.\nDocumentation and handoff."
      : note
        ? `${note}\nTesting and quality assurance for ${src.name}.\nDocumentation for ${src.name}.`
        : `Design and implement ${src.name}.\nTesting and quality assurance for ${src.name}.\nDocumentation for ${src.name}.`,
    deliverablesText: `${src.name}, delivered and accepted.`,
    acceptanceText: lump ? "Delivered scope meets agreed requirements and passes review." : `${src.name} meets agreed scope and passes review.`,
  };
}

export function buildContractPhases(option: OptionLike): ContractPhase[] {
  const lump = !option.phases?.length;
  return sourcePhasesFor(option).map((src) => contractPhaseFrom(src, lump));
}

/** Fingerprint of a phase structure — mismatch vs the live option = stale contract. */
export function phaseSignature(phases: { name: string; amountCents: number; weeks: number | null }[]): string {
  return JSON.stringify(phases.map((ph) => ({ n: ph.name, a: ph.amountCents, w: ph.weeks })));
}

const SCOPE_OF_ENGAGEMENT =
  "Wahala Group will provide the software engineering, architecture, implementation, testing, and deployment services required to deliver the scope described in this proposal. This engagement excludes ongoing operational support, feature work outside the agreed scope, and any activity not explicitly listed below unless authorized through a written change order.";

const OUT_OF_SCOPE =
  "Features not described in this Statement of Work.\nWork outside the phases and deliverables listed above.\nOngoing operations and maintenance after project completion.\nThird-party integrations outside agreed scope.";

const CHANGE_MANAGEMENT =
  "Any requested work outside the scope defined in this Statement of Work requires a written Change Order describing the requested change, schedule impact, and any adjustment to cost. No additional work begins until the Change Order is approved by both parties.";

export function contractDefaults(input: {
  dealId: string;
  complexityScore: number;
  option: OptionLike;
  approvers: Approver[] | null;
  generatedAt: string;
}): ProposalContract {
  const phases = buildContractPhases(input.option);
  const heavy = input.complexityScore > 3;
  const charSum = input.dealId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const first = input.approvers?.[0];
  return {
    status: "draft",
    proposalNumber: `WG-2026-${String(100 + (charSum % 900))}`,
    scopeOfEngagement: SCOPE_OF_ENGAGEMENT,
    phases,
    depositPct: 10,
    outOfScopeEnabled: heavy,
    outOfScopeText: OUT_OF_SCOPE,
    changeManagementEnabled: heavy,
    changeManagementText: CHANGE_MANAGEMENT,
    acceptanceReviewDays: 5,
    clientSignerName: first?.name ?? "",
    clientSignerTitle: first?.role ?? "",
    ourSignerName: "Jason Milton",
    ourSignerTitle: "Managing Member",
    sourceOptionId: input.option.id,
    sourceSignature: phaseSignature(phases),
    amendments: [],
    generatedAt: input.generatedAt,
  };
}

/** Resync: rebuild phases from the live option, preserving written text for name-matched phases. */
export function mergeContractPhases(oldPhases: ContractPhase[], option: OptionLike): ContractPhase[] {
  const lump = !option.phases?.length;
  return sourcePhasesFor(option).map((src) => {
    const match = oldPhases.find((op) => op.name === src.name);
    const rebuilt = contractPhaseFrom(src, lump);
    return match
      ? { ...rebuilt, objective: match.objective, scopeText: match.scopeText, deliverablesText: match.deliverablesText, acceptanceText: match.acceptanceText }
      : rebuilt;
  });
}

// ---------------------------------------------------------------- payment schedule

export type PaymentRow = { label: string; amountCents: number };

/**
 * Deposit at execution, then per-phase acceptance payments; the FIRST phase's
 * payment is reduced by the deposit already collected. Total = the snapshot's
 * own phase sum (an edited contract's numbers are its own — §5.3).
 */
export function paymentSchedule(contract: Pick<ProposalContract, "phases" | "depositPct">): { depositCents: number; rows: PaymentRow[]; totalCents: number } {
  const totalCents = contract.phases.reduce((n, p) => n + p.amountCents, 0);
  const depositCents = Math.round((totalCents * contract.depositPct) / 100);
  const multi = contract.phases.length > 1;
  const rows: PaymentRow[] = [{ label: "Contract Execution (Deposit)", amountCents: depositCents }];
  contract.phases.forEach((ph, i) => {
    rows.push({
      label: multi ? `Phase ${i + 1} Acceptance — ${ph.name}` : `${ph.name} Acceptance`,
      amountCents: i === 0 ? Math.max(0, ph.amountCents - depositCents) : ph.amountCents,
    });
  });
  return { depositCents, rows, totalCents };
}

/** The Acceptance clause's generated sentence. */
export function acceptanceSentence(clientName: string, days: number): string {
  return `${clientName || "The client"} will review each delivered phase within ${days} business day${days === 1 ? "" : "s"}; unless written objections are raised in that window, the delivery is deemed accepted.`;
}
