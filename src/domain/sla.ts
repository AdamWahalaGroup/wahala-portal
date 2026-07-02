/**
 * SLA & nudge settings — pure domain (no DB). Admin-tunable thresholds that decide
 * when the Board turns something amber. Per the design (frame 28) these NUDGE, never
 * block — same philosophy as sales stages: the portal reports, it doesn't gate.
 *
 * Defaults are the values that were previously hardcoded (STUCK_AFTER_DAYS = 14, the
 * STAGE_META probability anchors). The stored settings row carries only overrides; the
 * effective settings are default ⊕ stored.
 */
import type { DealStage } from "@/domain/sales";
import { FUNNEL_STAGES, STAGE_META, STUCK_AFTER_DAYS, daysInStage } from "@/domain/sales";

export type NudgeDigest = "off" | "monday" | "daily";

export type SlaSettings = {
  /** A deal untouched this long in its stage flags ⚠ (global fallback). */
  stuckWindowDays: number;
  /** Per-stage stuck-window overrides; absent stage = use the global window. */
  stuckPerStage: Partial<Record<DealStage, number>>;
  /** Win-probability anchor per funnel stage (percent), or null for "no anchor / 50% fallback". */
  probabilityAnchors: Record<DealStage, number | null>;
  /** A new lead unqualified/unscored this long flags ⚠ on its Triage card. */
  leadTriageDays: number;
  /** A sent proposal with no client response this long prompts the owner. */
  proposalFollowupDays: number;
  /** Delivery-side "waiting on you" window before the nudge escalates. */
  clientWaitingDays: number;
  /** Where nudges go. Delivery of digests/emails is a scheduled job (not yet shipped). */
  nudge: {
    notifyOwnerInApp: boolean;
    adminDigest: NudgeDigest;
    /** Escalate to email after N unactioned days, or null = never. */
    escalateEmailDays: number | null;
  };
};

const DEFAULT_ANCHORS = FUNNEL_STAGES.reduce(
  (acc, s) => ({ ...acc, [s]: STAGE_META[s].probabilityPct }),
  {} as Record<DealStage, number | null>,
);

export const DEFAULT_SLA_SETTINGS: SlaSettings = {
  stuckWindowDays: STUCK_AFTER_DAYS,
  stuckPerStage: {},
  probabilityAnchors: DEFAULT_ANCHORS,
  leadTriageDays: 3,
  proposalFollowupDays: 7,
  clientWaitingDays: 2,
  nudge: { notifyOwnerInApp: true, adminDigest: "monday", escalateEmailDays: null },
};

const clampDays = (n: unknown, fallback: number): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 365 ? v : fallback;
};

const clampPct = (n: unknown): number | null => {
  if (n === null || n === undefined || n === "") return null;
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
};

/** Merge a stored (partial, possibly malformed) settings blob onto the defaults. */
export function resolveSla(stored: unknown): SlaSettings {
  const s = (stored ?? {}) as Partial<SlaSettings>;
  const perStage: Partial<Record<DealStage, number>> = {};
  for (const stage of FUNNEL_STAGES) {
    const v = s.stuckPerStage?.[stage];
    if (v !== undefined && v !== null) perStage[stage] = clampDays(v, DEFAULT_SLA_SETTINGS.stuckWindowDays);
  }
  const anchors = { ...DEFAULT_ANCHORS };
  for (const stage of FUNNEL_STAGES) {
    if (s.probabilityAnchors && stage in s.probabilityAnchors) anchors[stage] = clampPct(s.probabilityAnchors[stage]);
  }
  const nudge: Partial<SlaSettings["nudge"]> = s.nudge ?? {};
  return {
    stuckWindowDays: clampDays(s.stuckWindowDays, DEFAULT_SLA_SETTINGS.stuckWindowDays),
    stuckPerStage: perStage,
    probabilityAnchors: anchors,
    leadTriageDays: clampDays(s.leadTriageDays, DEFAULT_SLA_SETTINGS.leadTriageDays),
    proposalFollowupDays: clampDays(s.proposalFollowupDays, DEFAULT_SLA_SETTINGS.proposalFollowupDays),
    clientWaitingDays: clampDays(s.clientWaitingDays, DEFAULT_SLA_SETTINGS.clientWaitingDays),
    nudge: {
      notifyOwnerInApp: nudge.notifyOwnerInApp !== false,
      adminDigest: (["off", "monday", "daily"] as const).includes(nudge.adminDigest as NudgeDigest)
        ? (nudge.adminDigest as NudgeDigest)
        : DEFAULT_SLA_SETTINGS.nudge.adminDigest,
      escalateEmailDays:
        nudge.escalateEmailDays === null || nudge.escalateEmailDays === undefined
          ? null
          : clampDays(nudge.escalateEmailDays, 3),
    },
  };
}

/** Effective stuck window for a stage: its override, else the global window. */
export function stuckDaysForStage(stage: DealStage, sla: SlaSettings): number {
  return sla.stuckPerStage[stage] ?? sla.stuckWindowDays;
}

/** Is an open deal stuck under these settings? (terminal stages are never stuck.) */
export function isStuckWith(stage: DealStage, stageEnteredAt: Date, now: Date, sla: SlaSettings): boolean {
  if (stage === "won" || stage === "lost") return false;
  return daysInStage(stageEnteredAt, now) >= stuckDaysForStage(stage, sla);
}

/** Has a still-new lead sat past the triage SLA? */
export function isLeadOverdue(createdAt: Date, now: Date, sla: SlaSettings): boolean {
  return daysInStage(createdAt, now) >= sla.leadTriageDays;
}
