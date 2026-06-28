/** Cents → "$2,500.00". */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Human label for a stage action (verb shown on a button). */
export const ACTION_LABELS: Record<string, string> = {
  send_quote: "Send quote",
  approve_quote: "Approve quote",
  reject_quote: "Reject quote",
  mark_paid: "Mark paid",
  start_work: "Start work",
  resume_work: "Resume work",
  deliver: "Deliver",
  accept: "Accept",
  request_revision: "Request revision",
  redraft: "Re-draft",
};
