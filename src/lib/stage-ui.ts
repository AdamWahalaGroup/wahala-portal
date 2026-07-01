/** UI derivations from a stage's status (presentation only — server enforces real rules). */
import type { BillingMode, StageStatus } from "@/domain/stage-machine";

/** Whose court the ball is in, by status. Billing mode changes the "approved" case:
 *  upfront waits on the client (to pay); on_delivery waits on Wahala (to start work). */
export function waitingParty(
  status: StageStatus,
  billingMode: BillingMode = "upfront",
): "client" | "wahala" | "none" {
  switch (status) {
    case "quoted":
    case "delivered":
      return "client";
    case "approved":
      return billingMode === "on_delivery" ? "wahala" : "client";
    case "draft":
    case "paid":
    case "in_progress":
    case "needs_revision":
      return "wahala";
    default:
      return "none"; // accepted, rejected
  }
}

/** Short CTA for a stage that needs the viewer's attention, or null if it doesn't. */
export function onYouCta(
  status: StageStatus,
  isStaff: boolean,
  billingMode: BillingMode = "upfront",
): string | null {
  if (isStaff) {
    switch (status) {
      case "draft":
        return "Send quote";
      case "approved":
        // On-delivery: kick off work immediately. Upfront: still waiting on payment.
        return billingMode === "on_delivery" ? "Start work" : "Mark paid";
      case "paid":
        return "Start work";
      case "in_progress":
        return "Deliver";
      case "needs_revision":
        return "Resume work";
      default:
        return null;
    }
  }
  switch (status) {
    case "quoted":
      return "Review & approve";
    case "approved":
      // On-delivery: nothing for the client to do — work is starting.
      return billingMode === "on_delivery" ? null : "Pay to begin";
    case "delivered":
      return "Review & accept";
    default:
      return null;
  }
}
