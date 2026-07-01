/**
 * Sales pipeline domain — pure logic, no DB.
 *
 * Stages are DISPOSITIONS, not a state machine (docs/brain_storming/synthesis.md):
 * a deal may move from any stage to any stage, and stages may be skipped ("this and
 * this can happen in one phone call"). The portal enforces gates, reports on stages —
 * and there are no gates inside the sales funnel itself; the first hard gate is the
 * contract (payment / engineering), which lives on projects and phases.
 *
 * Probability anchors come from the funnel model: pre-proposal percentages are the
 * chance of REACHING proposal; the percentage resets at proposal (a new race to close).
 */
import { DEAL_STAGES } from "@/db/schema";

export type DealStage = (typeof DEAL_STAGES)[number];

/** Funnel stages in display order — the open pipeline (won/lost are terminal). */
export const FUNNEL_STAGES = [
  "discovery",
  "business_requirements",
  "solution_design",
  "proposal",
  "negotiation",
  "contract",
] as const satisfies readonly DealStage[];

export const TERMINAL_STAGES = ["won", "lost"] as const satisfies readonly DealStage[];

export type StageMeta = {
  label: string;
  /** Win-probability anchor (percent), or null where the funnel resets / has no anchor yet. */
  probabilityPct: number | null;
  /** What the probability is toward — reaching proposal, or closing the deal. */
  toward: "proposal" | "close" | null;
};

export const STAGE_META: Record<DealStage, StageMeta> = {
  discovery: { label: "Discovery", probabilityPct: 10, toward: "proposal" },
  business_requirements: { label: "Business requirements", probabilityPct: 20, toward: "proposal" },
  solution_design: { label: "Solution design", probabilityPct: 90, toward: "proposal" },
  // Probability resets at proposal — no anchor agreed yet for the close race.
  proposal: { label: "Proposal", probabilityPct: null, toward: "close" },
  negotiation: { label: "Negotiation", probabilityPct: null, toward: "close" },
  contract: { label: "Contract", probabilityPct: null, toward: "close" },
  won: { label: "Won", probabilityPct: 100, toward: null },
  lost: { label: "Lost", probabilityPct: 0, toward: null },
};

/** A deal sitting in one stage this long (or longer) is flagged in the funnel view. */
export const STUCK_AFTER_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/** Whole days a deal has been in its current stage (floored; same-day = 0). */
export function daysInStage(stageEnteredAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - stageEnteredAt.getTime()) / MS_PER_DAY));
}

export function isStuck(stageEnteredAt: Date, now: Date): boolean {
  return daysInStage(stageEnteredAt, now) >= STUCK_AFTER_DAYS;
}

export function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value);
}
