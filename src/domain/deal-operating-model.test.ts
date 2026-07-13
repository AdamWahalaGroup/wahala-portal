import { describe, expect, it } from "vitest";
import { actionUrgencyScore, nextActionTiming } from "./deal-operating-model";

const now = new Date("2026-07-13T12:00:00.000Z");

describe("actionUrgencyScore", () => {
  it("puts missing commitments at the top", () => {
    expect(actionUrgencyScore({ nextAction: null, nextActionDueAt: null, now })).toBe(100);
    expect(actionUrgencyScore({ nextAction: "Send questions", nextActionDueAt: null, now })).toBe(100);
  });

  it("makes overdue work more urgent than future work", () => {
    const overdue = actionUrgencyScore({ nextAction: "Follow up", nextActionDueAt: new Date("2026-07-10T12:00:00.000Z"), now });
    const future = actionUrgencyScore({ nextAction: "Hold discovery", nextActionDueAt: new Date("2026-07-20T12:00:00.000Z"), now });
    expect(overdue).toBeGreaterThan(future);
  });

  it("does not use portfolio fit or value", () => {
    expect(actionUrgencyScore({ nextAction: "Confirm buyer", nextActionDueAt: new Date("2026-07-14T12:00:00.000Z"), now })).toBe(80);
  });

  it("treats a date-only deadline as due all day", () => {
    expect(actionUrgencyScore({ nextAction: "Send proposal", nextActionDueAt: new Date("2026-07-13T00:00:00.000Z"), now })).toBe(90);
  });
});

describe("nextActionTiming", () => {
  it("explains missing and overdue commitments", () => {
    expect(nextActionTiming({ nextAction: null, nextActionDueAt: null, now }).label).toBe("next commitment missing");
    expect(nextActionTiming({ nextAction: "Follow up", nextActionDueAt: new Date("2026-07-11T12:00:00.000Z"), now }).label).toBe("2d overdue");
  });
});
