/** UI derivations from a stage's status (presentation only — server enforces real rules). */
import type { StageStatus } from "@/domain/stage-machine";

/** Whose court the ball is in, by status. */
export function waitingParty(status: StageStatus): "client" | "wahala" | "none" {
  switch (status) {
    case "quoted":
    case "approved":
    case "delivered":
      return "client";
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
export function onYouCta(status: StageStatus, isStaff: boolean): string | null {
  if (isStaff) {
    switch (status) {
      case "draft":
        return "Send quote";
      case "approved":
        return "Mark paid";
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
      return "Pay to begin";
    case "delivered":
      return "Review & accept";
    default:
      return null;
  }
}
