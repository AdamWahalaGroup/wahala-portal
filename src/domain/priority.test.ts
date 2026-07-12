import { describe, expect, it } from "vitest";
import { momentumFrom, dealBudgetCents, priorityScore } from "./priority";

describe("momentumFrom", () => {
  it("fresh, untroubled deal holds ~1", () => {
    expect(momentumFrom({ daysSinceTouch: 0, rescheduleCount: 0, proposalSilentDays: 0 })).toBe(1);
    expect(momentumFrom({ daysSinceTouch: 2, rescheduleCount: 0, proposalSilentDays: 0 })).toBe(1);
  });
  it("neglect decays with a ~7-day half-life", () => {
    const nineDays = momentumFrom({ daysSinceTouch: 9, rescheduleCount: 0, proposalSilentDays: 0 });
    expect(nineDays).toBeGreaterThan(0.45);
    expect(nineDays).toBeLessThan(0.55);
  });
  it("each reschedule knocks the deal down — three reschedules halve it", () => {
    const three = momentumFrom({ daysSinceTouch: 0, rescheduleCount: 3, proposalSilentDays: 0 });
    expect(three).toBeCloseTo(0.51, 1);
  });
  it("floors at 0.1 — a deal never fully disappears", () => {
    expect(momentumFrom({ daysSinceTouch: 90, rescheduleCount: 8, proposalSilentDays: 60 })).toBe(0.1);
  });
});

describe("dealBudgetCents", () => {
  it("scales with value and stage anchor", () => {
    expect(dealBudgetCents(30000_00, 25)).toBe(3000); // $30k discovery → $30
    expect(dealBudgetCents(30000_00, 90)).toBe(10800); // $30k committed → $108
  });
  it("floors at $2 so small deals still get a pulse", () => {
    expect(dealBudgetCents(500_00, 10)).toBe(200);
    expect(dealBudgetCents(0, null)).toBe(200);
  });
  it("null anchor treated as 50%", () => {
    expect(dealBudgetCents(50000_00, null)).toBe(Math.round(50000_00 * 0.004 * 0.5));
  });
});

describe("priorityScore", () => {
  it("normalizes: $10k, fit 5, anchor 50, momentum 1 → 25", () => {
    expect(priorityScore({ fit: 5, valueCents: 10000_00, anchorPct: 50, momentum: 1 })).toBe(25);
  });
  it("fit beats raw size: high-fit $15k outranks poor-fit $200k", () => {
    const smallGood = priorityScore({ fit: 9, valueCents: 15000_00, anchorPct: 50, momentum: 1 });
    const bigBad = priorityScore({ fit: 2, valueCents: 200000_00, anchorPct: 50, momentum: 1 });
    expect(smallGood).toBeGreaterThan(bigBad);
  });
  it("momentum drags a stalled deal below a fresh smaller one", () => {
    const stalled = priorityScore({ fit: 7, valueCents: 50000_00, anchorPct: 55, momentum: 0.2 });
    const fresh = priorityScore({ fit: 7, valueCents: 20000_00, anchorPct: 55, momentum: 1 });
    expect(fresh).toBeGreaterThan(stalled);
  });
  it("null fit is neutral (5); zero value scores 0", () => {
    expect(priorityScore({ fit: null, valueCents: 10000_00, anchorPct: 50, momentum: 1 })).toBe(25);
    expect(priorityScore({ fit: 10, valueCents: 0, anchorPct: 90, momentum: 1 })).toBe(0);
  });
});
