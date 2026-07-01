import { describe, it, expect } from "vitest";
import {
  STAGE_TRANSITIONS,
  ACTION_TRANSITION,
  canTransition,
  assertMarkPaidOnDelivery,
  assertStageAction,
  assertPayGate,
  requiresAdminApproval,
  StageError,
  stageTransitionsFor,
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

describe("on_delivery billing mode", () => {
  it("skips paid — approved goes straight to in_progress", () => {
    const t = stageTransitionsFor("on_delivery");
    expect(t.approved).toEqual(["in_progress"]);
    expect(canTransition("approved", "in_progress", "on_delivery")).toBe(true);
    expect(canTransition("approved", "paid", "on_delivery")).toBe(false);
  });

  it("start_work is legal from approved WITHOUT paidAt", () => {
    expect(() =>
      assertStageAction("start_work", "approved", { paidAt: null, billingMode: "on_delivery" }),
    ).not.toThrow();
  });

  it("moves the pay-gate to accept — accept unpaid is blocked", () => {
    expect(() =>
      assertPayGate("accepted", null, "on_delivery"),
    ).toThrow(/accepted until payment/i);
    expect(() =>
      assertStageAction("accept", "delivered", { paidAt: null, billingMode: "on_delivery" }),
    ).toThrow(/accepted until payment/i);
  });

  it("accept succeeds once paidAt is set", () => {
    expect(() =>
      assertStageAction("accept", "delivered", { paidAt: new Date(), billingMode: "on_delivery" }),
    ).not.toThrow();
  });

  it("upfront mode is unaffected — paid → in_progress still gated by paidAt", () => {
    expect(() =>
      assertStageAction("start_work", "paid", { paidAt: null, billingMode: "upfront" }),
    ).toThrow(/payment/i);
    // Default (no billingMode passed) behaves as upfront.
    expect(() => assertStageAction("start_work", "paid", { paidAt: null })).toThrow(/payment/i);
  });

  it("mark_paid in on_delivery is legal from post-approval statuses; blocked after already-paid", () => {
    expect(() => assertMarkPaidOnDelivery("approved", null)).not.toThrow();
    expect(() => assertMarkPaidOnDelivery("in_progress", null)).not.toThrow();
    expect(() => assertMarkPaidOnDelivery("delivered", null)).not.toThrow();
    expect(() => assertMarkPaidOnDelivery("needs_revision", null)).not.toThrow();
    expect(() => assertMarkPaidOnDelivery("draft", null)).toThrow(/status "draft"/);
    expect(() => assertMarkPaidOnDelivery("quoted", null)).toThrow(/status "quoted"/);
    expect(() => assertMarkPaidOnDelivery("accepted", null)).toThrow(/status "accepted"/);
    expect(() => assertMarkPaidOnDelivery("approved", new Date())).toThrow(/already marked paid/i);
  });

  it("mark_paid via assertStageAction is not a status transition in on_delivery mode", () => {
    // In on_delivery mode, mark_paid isn't in the transition map. The service is expected
    // to route it via applyMarkPaidOnDelivery; if it accidentally goes through
    // assertStageAction, we throw INVALID_STATE rather than silently transitioning.
    expect(() =>
      assertStageAction("mark_paid", "in_progress", { paidAt: null, billingMode: "on_delivery" }),
    ).toThrow(/not a status transition/);
  });
});

describe("threshold", () => {
  it("requires admin co-sign strictly above the threshold", () => {
    expect(requiresAdminApproval(500_001, 500_000)).toBe(true);
    expect(requiresAdminApproval(500_000, 500_000)).toBe(false);
    expect(requiresAdminApproval(0, 500_000)).toBe(false);
  });
});
