/**
 * Priority math (docs/AGENT-LAYER-DESIGN.md) — pure, deterministic, cheap
 * enough to recompute hourly for every open deal.
 *
 *   priority = fit × value × stage-anchor × momentum
 *
 * It answers "Jason has 40 hours this week and 60 hours of people to talk to —
 * who's first?" Not win probability, not just deal size: best use of us, now.
 * Relative imports only — the cron worker bundles this via services/pulse.
 */

export type MomentumInput = {
  /** Days since the last human/client touch (process event, call, meeting, stage move). */
  daysSinceTouch: number;
  /** Times the client rescheduled/declined meetings on this deal. */
  rescheduleCount: number;
  /** Days a SENT proposal has sat unanswered (0 when none outstanding). */
  proposalSilentDays: number;
};

/**
 * Momentum decay 0.1–1: fresh deals hold ~1, neglected/rescheduled deals sink.
 * "Missed meetings should absolutely drop the opportunity lower."
 */
export function momentumFrom(m: MomentumInput): number {
  // Half-life on touch: ~1.0 at 0–2 days, 0.5 at ~9 days, floor at 0.1.
  const touch = Math.pow(0.5, Math.max(0, m.daysSinceTouch - 2) / 7);
  // Each reschedule knocks 20% off; silence past a week compounds gently.
  const reschedule = Math.pow(0.8, m.rescheduleCount);
  const silence = Math.pow(0.9, Math.max(0, m.proposalSilentDays - 7) / 7);
  return Math.max(0.1, Math.round(touch * reschedule * silence * 100) / 100);
}

/**
 * The per-deal agent budget in cents: "what's realistic to spend to get the
 * check in the bank" — a slice of the value, scaled by how real the money is.
 * max($2, 0.4% × value × anchor%). A $30k deal: $30 at Discovery (25%),
 * $108 at Committed (90%).
 */
export function dealBudgetCents(valueCents: number, anchorPct: number | null): number {
  const anchor = (anchorPct ?? 50) / 100;
  return Math.max(200, Math.round(valueCents * 0.004 * anchor));
}

export type PriorityInput = {
  /** Fit 0–10 (AI-scored "value to the business"); null → neutral 5. */
  fit: number | null;
  valueCents: number;
  /** Stage win-probability anchor 0–100 (SLA settings); null → 50. */
  anchorPct: number | null;
  /** Momentum 0.1–1 from momentumFrom. */
  momentum: number;
};

/**
 * Priority score, normalized so a $10k deal at fit 5 / anchor 50% / momentum 1
 * scores 25 — readable numbers, not floating dust. Log-scale on value so a
 * $200k deal doesn't drown every $15k deal regardless of fit.
 */
export function priorityScore(p: PriorityInput): number {
  if (p.valueCents <= 0) return 0;
  const fit = (p.fit ?? 5) / 10;
  const anchor = (p.anchorPct ?? 50) / 100;
  // log10($) : $1k→3, $10k→4, $100k→5 — value matters, but sub-linearly.
  const valueFactor = Math.log10(Math.max(1, p.valueCents / 100));
  return Math.round(fit * anchor * valueFactor * p.momentum * 25 * 10) / 10;
}
