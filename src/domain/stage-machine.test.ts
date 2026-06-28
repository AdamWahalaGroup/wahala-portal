import { describe, it, expect } from "vitest";
import {
  STAGE_TRANSITIONS,
  ACTION_TRANSITION,
  canTransition,
  assertStageAction,
  assertPayGate,
  requiresAdminApproval,
  StageError,
  type StageStatus,
} from "@/domain/stage-machine";

describe("stage transitions", () => {
  it("allows the happy-path edges", () => {
    expect(canTransition("draft", "quoted")).toBe(true);
    expect(canTransition("quoted", "approved")).toBe(true);
    expect(canTransition("approved", "paid")).toBe(true);
    expect(canTransition("paid", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "delivered")).toBe(true);
    expect(canTransition("delivered", "accepted")).toBe(true);
  });

  it("rejects skipping the payment step", () => {
    expect(canTransition("approved", "in_progress")).toBe(false);
    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("quoted", "in_progress")).toBe(false);
  });

  it("treats accepted as terminal", () => {
    expect(STAGE_TRANSITIONS.accepted).toEqual([]);
  });

  it("every action maps to a legal transition edge", () => {
    for (const [action, edge] of Object.entries(ACTION_TRANSITION)) {
      expect(canTransition(edge.from, edge.to), `${action}: ${edge.from}->${edge.to}`).toBe(true);
    }
  });
});

describe("pay-gate invariant (no delivery before payment)", () => {
  it("blocks in_progress when unpaid", () => {
    expect(() => assertPayGate("in_progress", null)).toThrow(StageError);
    expect(() => assertPayGate("in_progress", undefined)).toThrow(/payment/i);
  });

  it("permits in_progress once paid", () => {
    expect(() => assertPayGate("in_progress", new Date())).not.toThrow();
    expect(() => assertPayGate("in_progress", 1_700_000_000)).not.toThrow();
  });

  it("does not constrain non-start transitions", () => {
    expect(() => assertPayGate("delivered", null)).not.toThrow();
    expect(() => assertPayGate("approved", null)).not.toThrow();
  });

  it("in_progress is only reachable from paid or needs_revision", () => {
    const incoming = (Object.entries(STAGE_TRANSITIONS) as [StageStatus, StageStatus[]][])
      .filter(([, tos]) => tos.includes("in_progress"))
      .map(([from]) => from)
      .sort();
    expect(incoming).toEqual(["needs_revision", "paid"]);
  });
});

describe("assertStageAction", () => {
  it("start_work succeeds from paid (with payment) and fails from approved", () => {
    expect(() => assertStageAction("start_work", "paid", { paidAt: new Date() })).not.toThrow();
    expect(() => assertStageAction("start_work", "approved", { paidAt: null })).toThrow(/Cannot start_work/);
  });

  it("a corrupt paid row with no paidAt still can't start (defense in depth)", () => {
    // Even if status somehow reads 'paid', a null paidAt trips the pay-gate.
    expect(() => assertStageAction("start_work", "paid", { paidAt: null })).toThrow(/payment/i);
  });

  it("deliver only from in_progress; accept only from delivered", () => {
    expect(() => assertStageAction("deliver", "in_progress", { paidAt: new Date() })).not.toThrow();
    expect(() => assertStageAction("deliver", "paid", { paidAt: new Date() })).toThrow();
    expect(() => assertStageAction("accept", "delivered", { paidAt: new Date() })).not.toThrow();
    expect(() => assertStageAction("accept", "in_progress", { paidAt: new Date() })).toThrow();
  });
});

describe("threshold", () => {
  it("requires admin co-sign strictly above the threshold", () => {
    expect(requiresAdminApproval(500_001, 500_000)).toBe(true);
    expect(requiresAdminApproval(500_000, 500_000)).toBe(false);
    expect(requiresAdminApproval(0, 500_000)).toBe(false);
  });
});
