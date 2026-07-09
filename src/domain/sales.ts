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
// Relative import (not the @/ alias) so the standalone cron Worker can bundle this chain.
import { DEAL_STAGES } from "../db/schema";

export type DealStage = (typeof DEAL_STAGES)[number];

/** Funnel stages in display order — the open pipeline (won/lost are terminal).
 * OPPORTUNITIES RESTRUCTURE (HANDOFF-DELTA-2026-07-09): 'new' opens the pipeline —
 * an opportunity is the deal record at stage new; accepting it starts Discovery.
 * Triage-as-a-column-of-contacts is retired. */
export const FUNNEL_STAGES = [
  "new",
  "discovery",
  "proposal_out",
  "negotiating",
  "committed",
] as const satisfies readonly DealStage[];

export const TERMINAL_STAGES = ["won", "lost"] as const satisfies readonly DealStage[];

export type StageMeta = {
  label: string;
  /** Close-probability anchor (percent) — drives the weighted pipeline + column meta. */
  probabilityPct: number | null;
  /** What the probability is toward (kept for settings copy; all anchors are to close now). */
  toward: "proposal" | "close" | null;
};

export const STAGE_META: Record<DealStage, StageMeta> = {
  new: { label: "New", probabilityPct: 10, toward: "close" },
  discovery: { label: "Discovery", probabilityPct: 25, toward: "close" },
  proposal_out: { label: "Proposal out", probabilityPct: 55, toward: "close" },
  negotiating: { label: "Negotiating", probabilityPct: 75, toward: "close" },
  committed: { label: "Committed", probabilityPct: 90, toward: "close" },
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

// ---- Proposal complexity (1–5, AI-scored) ----
// "One to five, this project's a three, anything three and under, quote it and move
// on. Three point one and over needs to go to engineering for hardcore review."
export const COMPLEXITY_MIN = 1;
export const COMPLEXITY_MAX = 5;
export const ENGINEERING_REVIEW_ABOVE = 3;

/** True when the AI's complexity read says engineering should review before sending. */
export function needsEngineeringReview(score: number | null): boolean {
  return score !== null && score > ENGINEERING_REVIEW_ABOVE;
}

/** One-line "what to do next" for a deal in this stage — used by the board card peek. */
export function nextStepFor(stage: DealStage): string {
  switch (stage) {
    case "new":
      return "Accept the opportunity into Discovery to start the deal.";
    case "discovery":
      return "Capture the discovery call — requirements included — then draft the proposal. Sending it moves this deal to Proposal out.";
    case "proposal_out":
      return "Follow up — silence past the SLA is at-risk time.";
    case "negotiating":
      return "Close the open terms and get to a verbal yes.";
    case "committed":
      return "Complete the agreement package and collect the deposit.";
    case "won":
      return "Handed off — deal room is now a project.";
    case "lost":
      return "Closed lost — reason is in the history.";
  }
}
