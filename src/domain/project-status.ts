/**
 * Display status for a project, DERIVED from its phases. The projects.status
 * column is dead bookkeeping — nothing ever transitions it past "discovery"
 * (founder eval, 10 Jul), so surfaces that showed it were lying. Closeout logic
 * (closeoutPromptFor) already derives from stage acceptance; this is the same
 * idea for labels. No schema change — the column stays untouched.
 */

const WORKING: readonly string[] = ["paid", "in_progress", "delivered", "needs_revision"];

export type DerivedProjectStatus = { label: string; tone: "setup" | "active" | "complete" };

export function derivedProjectStatus(stageStatuses: readonly string[]): DerivedProjectStatus {
  if (stageStatuses.length === 0) return { label: "setting up", tone: "setup" };
  if (stageStatuses.every((s) => s === "accepted")) return { label: "complete", tone: "complete" };
  if (stageStatuses.some((s) => WORKING.includes(s))) return { label: "active", tone: "active" };
  return { label: "quoting", tone: "setup" };
}
