import { describe, it, expect } from "vitest";
import {
  DEFAULT_SLA_SETTINGS,
  resolveSla,
  stuckDaysForStage,
  isStuckWith,
  isLeadOverdue,
} from "./sla";
import { STUCK_AFTER_DAYS } from "./sales";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const NOW = new Date();

describe("resolveSla", () => {
  it("returns defaults for empty/garbage input", () => {
    expect(resolveSla(null)).toEqual(DEFAULT_SLA_SETTINGS);
    expect(resolveSla({})).toEqual(DEFAULT_SLA_SETTINGS);
    expect(resolveSla("nonsense")).toEqual(DEFAULT_SLA_SETTINGS);
  });

  it("default stuck window matches the legacy constant", () => {
    expect(DEFAULT_SLA_SETTINGS.stuckWindowDays).toBe(STUCK_AFTER_DAYS);
  });

  it("clamps out-of-range days and percents", () => {
    const s = resolveSla({ stuckWindowDays: 9999, leadTriageDays: -4, probabilityAnchors: { discovery: 250 } });
    expect(s.stuckWindowDays).toBe(DEFAULT_SLA_SETTINGS.stuckWindowDays); // 9999 rejected
    expect(s.leadTriageDays).toBe(DEFAULT_SLA_SETTINGS.leadTriageDays); // negative rejected
    expect(s.probabilityAnchors.discovery).toBeNull(); // 250 rejected → null
  });

  it("keeps valid per-stage overrides and anchors", () => {
    const s = resolveSla({ stuckPerStage: { solution_design: 7 }, probabilityAnchors: { proposal: 60 } });
    expect(s.stuckPerStage.solution_design).toBe(7);
    expect(s.probabilityAnchors.proposal).toBe(60);
  });
});

describe("stuckDaysForStage", () => {
  it("uses the per-stage override when present, else the global window", () => {
    const s = resolveSla({ stuckWindowDays: 14, stuckPerStage: { discovery: 5 } });
    expect(stuckDaysForStage("discovery", s)).toBe(5);
    expect(stuckDaysForStage("negotiation", s)).toBe(14);
  });
});

describe("isStuckWith", () => {
  it("respects a tighter per-stage window", () => {
    const s = resolveSla({ stuckWindowDays: 14, stuckPerStage: { discovery: 5 } });
    expect(isStuckWith("discovery", daysAgo(6), NOW, s)).toBe(true);
    expect(isStuckWith("discovery", daysAgo(4), NOW, s)).toBe(false);
    expect(isStuckWith("negotiation", daysAgo(6), NOW, s)).toBe(false);
  });

  it("never flags terminal stages", () => {
    const s = DEFAULT_SLA_SETTINGS;
    expect(isStuckWith("won", daysAgo(999), NOW, s)).toBe(false);
    expect(isStuckWith("lost", daysAgo(999), NOW, s)).toBe(false);
  });
});

describe("isLeadOverdue", () => {
  it("flags a lead older than the triage SLA", () => {
    const s = resolveSla({ leadTriageDays: 3 });
    expect(isLeadOverdue(daysAgo(4), NOW, s)).toBe(true);
    expect(isLeadOverdue(daysAgo(1), NOW, s)).toBe(false);
  });
});
