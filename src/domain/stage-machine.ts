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
import { BILLING_MODES, STAGE_STATUSES } from "@/db/schema";

export type StageStatus = (typeof STAGE_STATUSES)[number];
export type BillingMode = (typeof BILLING_MODES)[number];

/**
 * Legal status transitions per billing mode.
 *
 * - **upfront** (default): the classic pay-before-work spine. Money clears at
 *   `approved → paid`, then work starts at `paid → in_progress`.
 * - **on_delivery**: work starts on faith at `approved → in_progress`. The `paid`
 *   status is never entered — `paidAt` is set as a side-effect by mark_paid (see
 *   applyMarkPaidOnDelivery in the service). The pay-gate moves to acceptance.
 */
const TRANSITIONS_UPFRONT: Record<StageStatus, StageStatus[]> = {
  draft: ["quoted"],
  quoted: ["approved", "rejected", "draft"],
  approved: ["paid"], // awaiting payment — the gate
  paid: ["in_progress"], // ONLY way into in_progress (besides resuming a revision)
  in_progress: ["delivered"],
  delivered: ["accepted", "needs_revision"],
  needs_revision: ["in_progress"],
  accepted: [],
  rejected: ["draft"],
};

const TRANSITIONS_ON_DELIVERY: Record<StageStatus, StageStatus[]> = {
  draft: ["quoted"],
  quoted: ["approved", "rejected", "draft"],
  approved: ["in_progress"], // skip paid — start work on faith
  paid: ["in_progress"], // still legal (defensive; on_delivery never enters paid but if it did)
  in_progress: ["delivered"],
  delivered: ["accepted", "needs_revision"],
  needs_revision: ["in_progress"],
  accepted: [],
  rejected: ["draft"],
};

/** Back-compat export (upfront table, since existing callers assume upfront). */
export const STAGE_TRANSITIONS = TRANSITIONS_UPFRONT;

export function stageTransitionsFor(mode: BillingMode): Record<StageStatus, StageStatus[]> {
  return mode === "on_delivery" ? TRANSITIONS_ON_DELIVERY : TRANSITIONS_UPFRONT;
}

export function canTransition(from: StageStatus, to: StageStatus, mode: BillingMode = "upfront"): boolean {
  return stageTransitionsFor(mode)[from]?.includes(to) ?? false;
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

const ACTION_TRANSITION_UPFRONT: Record<StageAction, { from: StageStatus; to: StageStatus }> = {
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

/**
 * On-delivery mode: mark_paid is intentionally ABSENT here — it's a side-effect
 * (sets paidAt without changing status), handled specially in the service via
 * MARK_PAID_LEGAL_STATUSES. start_work goes approved → in_progress directly.
 */
const ACTION_TRANSITION_ON_DELIVERY: Record<Exclude<StageAction, "mark_paid">, { from: StageStatus; to: StageStatus }> = {
  send_quote: { from: "draft", to: "quoted" },
  approve_quote: { from: "quoted", to: "approved" },
  reject_quote: { from: "quoted", to: "rejected" },
  start_work: { from: "approved", to: "in_progress" },
  resume_work: { from: "needs_revision", to: "in_progress" },
  deliver: { from: "in_progress", to: "delivered" },
  accept: { from: "delivered", to: "accepted" },
  request_revision: { from: "delivered", to: "needs_revision" },
  redraft: { from: "rejected", to: "draft" },
};

/** Back-compat export (upfront actions). */
export const ACTION_TRANSITION = ACTION_TRANSITION_UPFRONT;

/**
 * In on_delivery mode, mark_paid is a side-effect (doesn't move the state) callable
 * from any post-approval, pre-accepted status. Draft/quoted/rejected/accepted are
 * excluded — before quote there's nothing agreed; after accept everything's closed.
 */
export const MARK_PAID_LEGAL_STATUSES: readonly StageStatus[] = [
  "approved",
  "in_progress",
  "delivered",
  "needs_revision",
];

export function actionTransitionFor(action: StageAction, mode: BillingMode): { from: StageStatus; to: StageStatus } | undefined {
  if (mode === "on_delivery") {
    if (action === "mark_paid") return undefined; // side-effect, not a transition
    return ACTION_TRANSITION_ON_DELIVERY[action];
  }
  return ACTION_TRANSITION_UPFRONT[action];
}

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
 * THE HARD INVARIANT (mode-aware): a stage may not cross the payment boundary
 * before payment is confirmed. Where the boundary sits differs by billing mode:
 *
 *  - **upfront**: pay-gate on `in_progress` — work cannot start unpaid.
 *  - **on_delivery**: pay-gate on `accepted` — the client cannot formally accept
 *    a delivery until admin has marked it paid.
 *
 * Both modes preserve "paid" as a load-bearing fact — just at different steps.
 */
export function assertPayGate(
  to: StageStatus,
  paidAt: Date | number | null | undefined,
  mode: BillingMode = "upfront",
): void {
  if (mode === "upfront" && to === "in_progress" && !paidAt) {
    throw new StageError("PAY_GATE", "A stage cannot start before its payment is confirmed.");
  }
  if (mode === "on_delivery" && to === "accepted" && !paidAt) {
    throw new StageError("PAY_GATE", "This stage can't be accepted until payment is confirmed.");
  }
}

/**
 * Validate a lifecycle action against the current persisted state.
 * Checks (a) the action is legal for the mode from this status and (b) the pay-gate.
 *
 * NOTE: mark_paid in on_delivery mode is a side-effect — call applyMarkPaidOnDelivery
 * in the service instead of routing it through here.
 */
export function assertStageAction(
  action: StageAction,
  currentStatus: StageStatus,
  stage: { paidAt: Date | number | null | undefined; billingMode?: BillingMode },
): { from: StageStatus; to: StageStatus } {
  const mode = stage.billingMode ?? "upfront";
  const edge = actionTransitionFor(action, mode);
  if (!edge) {
    throw new StageError(
      "INVALID_STATE",
      `Action "${action}" is not a status transition in ${mode} billing mode.`,
    );
  }
  if (currentStatus !== edge.from || !canTransition(edge.from, edge.to, mode)) {
    throw new StageError(
      "INVALID_STATE",
      `Cannot ${action} a stage in status "${currentStatus}".`,
    );
  }
  assertPayGate(edge.to, stage.paidAt, mode);
  return edge;
}

/**
 * Guard for mark_paid in on_delivery mode. Legal from any post-approval, pre-
 * accepted status; refuses if the phase is already paid (idempotence).
 */
export function assertMarkPaidOnDelivery(
  currentStatus: StageStatus,
  paidAt: Date | number | null | undefined,
): void {
  if (paidAt) {
    throw new StageError("INVALID_STATE", "This stage is already marked paid.");
  }
  if (!MARK_PAID_LEGAL_STATUSES.includes(currentStatus)) {
    throw new StageError(
      "INVALID_STATE",
      `Cannot mark paid — stage is in status "${currentStatus}".`,
    );
  }
}

/** Over the configurable threshold, a quote needs a Wahala admin co-sign (PLAN.md §4). */
export function requiresAdminApproval(totalAmountCents: number, thresholdCents: number): boolean {
  return totalAmountCents > thresholdCents;
}
