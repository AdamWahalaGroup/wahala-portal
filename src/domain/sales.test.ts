import { describe, it, expect } from "vitest";
import {
  FUNNEL_STAGES,
  TERMINAL_STAGES,
  STAGE_META,
  STUCK_AFTER_DAYS,
  daysInStage,
  isStuck,
  isDealStage,
  needsEngineeringReview,
} from "@/domain/sales";
import { DEAL_STAGES } from "@/db/schema";

describe("sales stage metadata", () => {
  it("covers every deal stage exactly once across funnel + terminal", () => {
    expect([...FUNNEL_STAGES, ...TERMINAL_STAGES].sort()).toEqual([...DEAL_STAGES].sort());
    for (const s of DEAL_STAGES) expect(STAGE_META[s]).toBeDefined();
  });

  it("anchors pre-proposal probabilities toward proposal, then resets", () => {
    expect(STAGE_META.discovery).toMatchObject({ probabilityPct: 10, toward: "proposal" });
    expect(STAGE_META.business_requirements).toMatchObject({ probabilityPct: 20, toward: "proposal" });
    expect(STAGE_META.solution_design).toMatchObject({ probabilityPct: 90, toward: "proposal" });
    // The percentage resets at proposal — a new race toward close.
    expect(STAGE_META.proposal.probabilityPct).toBeNull();
    expect(STAGE_META.proposal.toward).toBe("close");
  });

  it("validates stage strings", () => {
    expect(isDealStage("solution_design")).toBe(true);
    expect(isDealStage("won")).toBe(true);
    expect(isDealStage("paid")).toBe(false); // phase status, not a sales stage
    expect(isDealStage("")).toBe(false);
  });
});

describe("complexity review flag", () => {
  it("fast-tracks 3 and under; flags above 3", () => {
    expect(needsEngineeringReview(1)).toBe(false);
    expect(needsEngineeringReview(3)).toBe(false);
    expect(needsEngineeringReview(4)).toBe(true);
    expect(needsEngineeringReview(5)).toBe(true);
    expect(needsEngineeringReview(null)).toBe(false); // unscored (hand-written proposal)
  });
});

describe("days-in-stage / stuck detection", () => {
  const now = new Date("2026-07-01T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("floors to whole days and never goes negative", () => {
    expect(daysInStage(now, now)).toBe(0);
    expect(daysInStage(daysAgo(0.9), now)).toBe(0);
    expect(daysInStage(daysAgo(4), now)).toBe(4);
    expect(daysInStage(new Date(now.getTime() + 3_600_000), now)).toBe(0); // clock skew
  });

  it("flags stuck exactly at the threshold", () => {
    expect(isStuck(daysAgo(STUCK_AFTER_DAYS - 1), now)).toBe(false);
    expect(isStuck(daysAgo(STUCK_AFTER_DAYS), now)).toBe(true);
    expect(isStuck(daysAgo(STUCK_AFTER_DAYS + 30), now)).toBe(true);
  });
});
