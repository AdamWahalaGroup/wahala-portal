import { describe, expect, it } from "vitest";
import { fitIsStale } from "./pulse";

const d = (daysAgo: number, now: Date) => new Date(now.getTime() - daysAgo * 86_400_000);

describe("fitIsStale", () => {
  const now = new Date("2026-07-12T13:00:00Z");
  it("never scored → stale", () => {
    expect(fitIsStale({ fitScoredAt: null, stageEnteredAt: d(3, now) }, now)).toBe(true);
  });
  it("scored 2 days ago, no stage move → fresh", () => {
    expect(fitIsStale({ fitScoredAt: d(2, now), stageEnteredAt: d(10, now) }, now)).toBe(false);
  });
  it("scored 8 days ago → stale (weekly cadence)", () => {
    expect(fitIsStale({ fitScoredAt: d(8, now), stageEnteredAt: d(30, now) }, now)).toBe(true);
  });
  it("stage moved after the last score → stale immediately", () => {
    expect(fitIsStale({ fitScoredAt: d(2, now), stageEnteredAt: d(1, now) }, now)).toBe(true);
  });
});
