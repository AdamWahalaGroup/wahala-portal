/**
 * Stage state machine — the pay-as-you-go spine (PLAN.md §1).
 *
 * Pure, dependency-free decision logic: no DB, no Cloudflare, no auth. It answers
 * "is this transition legal, and does it violate the pay-gate?" so the rule that
 * matters most — NO DELIVERY BEFORE PAYMENT — is trivially unit-testable.
 *
 * Persistence + authorization live in the service (src/services/stages.ts) and
 * policy (src/auth/policy.ts); they call into here.
 */
import { STAGE_STATUSES } from "@/db/schema";

export type StageStatus = (typeof STAGE_STATUSES)[number];

/** Legal status transitions. Anything not listed is rejected. */
export const STAGE_TRANSITIONS: Record<StageStatus, StageStatus[]> = {
  draft: ["quoted"],
  quoted: ["approved", "rejected", "draft"], // client approves/rejects; owner can pull back to re-scope
  approved: ["paid"], // awaiting payment — the gate
  paid: ["in_progress"], // ONLY way into in_progress (besides resuming a revision)
  in_progress: ["delivered"],
  delivered: ["accepted", "needs_revision"],
  needs_revision: ["in_progress"], // already paid — work resumes
  accepted: [], // terminal; the next stage is a new row
  rejected: ["draft"], // re-scope and re-quote
};

export function canTransition(from: StageStatus, to: StageStatus): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** The lifecycle actions a user/system performs, mapped to their status edge. */
export type StageAction =
  | "send_quote"
  | "approve_quote"
  | "reject_quote"
  | "mark_paid"
  | "start_work"
  | "resume_work"
  | "deliver"
  | "accept"
  | "request_revision"
  | "redraft";

export const ACTION_TRANSITION: Record<StageAction, { from: StageStatus; to: StageStatus }> = {
  send_quote: { from: "draft", to: "quoted" },
  approve_quote: { from: "quoted", to: "approved" },
  reject_quote: { from: "quoted", to: "rejected" },
  mark_paid: { from: "approved", to: "paid" },
  start_work: { from: "paid", to: "in_progress" },
  resume_work: { from: "needs_revision", to: "in_progress" },
  deliver: { from: "in_progress", to: "delivered" },
  accept: { from: "delivered", to: "accepted" },
  request_revision: { from: "delivered", to: "needs_revision" },
  redraft: { from: "rejected", to: "draft" },
};

export type StageErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "PAY_GATE"
  | "CONFLICT" // lost an optimistic-concurrency (compare-and-swap) race
  | "VALIDATION";

export class StageError extends Error {
  constructor(
    readonly code: StageErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StageError";
  }
}

/**
 * THE HARD INVARIANT: a stage may not enter `in_progress` unless payment is
 * confirmed (`paidAt` set). Defense in depth — the transition graph already
 * routes through `paid`, but every write also passes through this guard.
 */
export function assertPayGate(to: StageStatus, paidAt: Date | number | null | undefined): void {
  if (to === "in_progress" && !paidAt) {
    throw new StageError("PAY_GATE", "A stage cannot start before its payment is confirmed.");
  }
}

/**
 * Validate a lifecycle action against the current persisted state.
 * Checks (a) the action is legal from this status and (b) the pay-gate.
 */
export function assertStageAction(
  action: StageAction,
  currentStatus: StageStatus,
  stage: { paidAt: Date | number | null | undefined },
): { from: StageStatus; to: StageStatus } {
  const edge = ACTION_TRANSITION[action];
  if (currentStatus !== edge.from || !canTransition(edge.from, edge.to)) {
    throw new StageError(
      "INVALID_STATE",
      `Cannot ${action} a stage in status "${currentStatus}".`,
    );
  }
  assertPayGate(edge.to, stage.paidAt);
  return edge;
}

/** Over the configurable threshold, a quote needs a Wahala admin co-sign (PLAN.md §4). */
export function requiresAdminApproval(totalAmountCents: number, thresholdCents: number): boolean {
  return totalAmountCents > thresholdCents;
}
