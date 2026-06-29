/**
 * Data-driven design tokens (the parts that vary by value, not by CSS rule).
 * Base/brand tokens live as CSS variables in globals.css; these map domain
 * values → exact colors per the design handoff (docs/design_handoff_wahala_portal).
 */
import type { StageStatus } from "@/domain/stage-machine";

/** Stage status → badge tint + dark text + solid dot, plus a human label. */
export const STATUS_STYLES: Record<StageStatus, { dot: string; bg: string; text: string; label: string }> = {
  draft: { dot: "#6b7280", bg: "#f1f2f4", text: "#4b5159", label: "Draft" },
  quoted: { dot: "#2563eb", bg: "#e8effe", text: "#1d4ed8", label: "Quoted" },
  approved: { dot: "#7c3aed", bg: "#f1ebfe", text: "#6d28d9", label: "Approved" },
  paid: { dot: "#0891b2", bg: "#e1f4f9", text: "#0e7490", label: "Paid" },
  in_progress: { dot: "#d97706", bg: "#fcefdc", text: "#b45309", label: "In progress" },
  delivered: { dot: "#0d9488", bg: "#dcf3f0", text: "#0f766e", label: "Delivered" },
  accepted: { dot: "#16a34a", bg: "#dcf5e3", text: "#15803d", label: "Accepted" },
  needs_revision: { dot: "#dc2626", bg: "#fbe3e3", text: "#b91c1c", label: "Needs revision" },
  rejected: { dot: "#b91c1c", bg: "#f6dede", text: "#991b1b", label: "Rejected" },
};

/** Lifecycle order for the stepper (branches handled separately). */
export const STEPPER_ORDER: StageStatus[] = [
  "draft",
  "quoted",
  "approved",
  "paid",
  "in_progress",
  "delivered",
  "accepted",
];

export const WAITING_ON = {
  you: { bg: "#fff7ed", text: "#b45309", border: "#fadcb4", dot: "#ea8a0d", label: "Waiting on you" },
  wahala: { bg: "#f4f5f7", text: "#5a6069", border: "#e7e8ec", dot: "#9aa0aa", label: "Waiting on Wahala" },
} as const;

export const VISIBILITY = {
  client_visible: { bg: "#eef0fe", text: "#2536c4", label: "Client-visible" },
  internal: { bg: "#16181d", text: "#cfd2da", label: "Internal only" },
} as const;
