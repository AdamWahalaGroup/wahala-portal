/**
 * Authorization policy (RBAC) — pure decision logic for stage actions.
 *
 * Authentication is Cloudflare magic-link; AUTHORIZATION is ours. This module is
 * the single place that answers "may THIS actor perform THIS action on THIS
 * stage?" combining three checks:
 *   1. role capability  — does the role grant the action at all?
 *   2. tenant scope     — a client may only act within their own org;
 *   3. ownership scope   — account-owner actions need the org's owner; lead
 *                          actions need the project's lead (admins bypass both).
 *
 * Pure (no DB/Cloudflare) so it is exhaustively unit-testable. The service loads
 * the resource and feeds it here before any write.
 */
import { USER_ROLES } from "@/db/schema";
import type { StageAction } from "@/domain/stage-machine";

export type UserRole = (typeof USER_ROLES)[number];

export type PolicyActor = {
  userId: string;
  userType: "wahala" | "client";
  role: UserRole;
  organizationId: string | null; // null for Wahala staff
  isAdmin: boolean; // wahala_admin
};

export type StageResource = {
  organizationId: string;
  projectLeadUserId: string | null;
  accountOwnerUserId: string | null;
};

export type Decision = { allowed: true } | { allowed: false; reason: string };

const ALLOW: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

/** Roles permitted to perform each action, before scope checks. */
const ROLE_CAPABILITIES: Record<StageAction, UserRole[]> = {
  // Owner side (relationship): quoting / re-scoping
  send_quote: ["wahala_admin", "account_owner"],
  redraft: ["wahala_admin", "account_owner"],
  // Delivery side: lead engineer (or admin)
  start_work: ["wahala_admin", "lead_engineer"],
  resume_work: ["wahala_admin", "lead_engineer"],
  deliver: ["wahala_admin", "lead_engineer"],
  // Payment: confirmed by Stripe webhook (system path); admins may mark paid manually
  mark_paid: ["wahala_admin"],
  // Client side: approve/reject a quote, formally accept, or ask for revision
  approve_quote: ["client_admin", "client_billing"],
  reject_quote: ["client_admin", "client_billing"],
  accept: ["client_admin", "client_billing"],
  request_revision: ["client_admin", "client_user", "client_billing"],
};

/** Actions performed by the client; gated on same-tenant. */
const CLIENT_ACTIONS = new Set<StageAction>([
  "approve_quote",
  "reject_quote",
  "accept",
  "request_revision",
]);

/** Actions that require being the project's Lead Engineer (admins exempt). */
const LEAD_ACTIONS = new Set<StageAction>(["start_work", "resume_work", "deliver"]);

/** Actions that require being the org's Account Owner (admins exempt). */
const OWNER_ACTIONS = new Set<StageAction>(["send_quote", "redraft"]);

/**
 * Decide whether `actor` may perform `action` on `resource`.
 * `overThreshold` flags an over-$threshold quote, which forces admin co-sign.
 */
export function canActOnStage(
  actor: PolicyActor,
  action: StageAction,
  resource: StageResource,
  opts: { overThreshold?: boolean } = {},
): Decision {
  // 1. Role capability
  if (!ROLE_CAPABILITIES[action].includes(actor.role)) {
    return deny(`Role "${actor.role}" cannot ${action}.`);
  }

  // 2. Over-threshold quotes require a Wahala admin co-sign
  if (action === "send_quote" && opts.overThreshold && !actor.isAdmin) {
    return deny("Quotes over the approval threshold require a Wahala admin co-sign.");
  }

  // 3. Tenant scope for client actions
  if (CLIENT_ACTIONS.has(action)) {
    if (actor.userType !== "client") return deny("Only client users can perform this action.");
    if (actor.organizationId !== resource.organizationId) {
      return deny("Cross-organization access is not allowed.");
    }
    return ALLOW;
  }

  // Staff actions below. Admins bypass ownership scoping.
  if (actor.isAdmin) return ALLOW;

  // 4. Ownership scope
  if (LEAD_ACTIONS.has(action) && actor.userId !== resource.projectLeadUserId) {
    return deny("Only the project's Lead Engineer (or a Wahala admin) can perform this action.");
  }
  if (OWNER_ACTIONS.has(action) && actor.userId !== resource.accountOwnerUserId) {
    return deny("Only the account's Owner (or a Wahala admin) can perform this action.");
  }

  return ALLOW;
}
