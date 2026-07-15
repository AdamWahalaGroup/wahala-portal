/**
 * Access scope — the single definition of "which tenants/projects may this user
 * touch." Computed once per request (in getAuthContext) and consumed by both the
 * scoped-query layer (src/db/scoped.ts) and the service-layer point checks, so
 * there is exactly ONE place that decides reach:
 *
 *   wahala_admin   → all orgs
 *   sales_rep      → deals they own; org scope supports related account context
 *   account_owner  → orgs they own (organizations.account_owner_user_id)
 *   lead/engineer  → only projects they lead or are a roster member of
 *   client roles   → their own org
 *
 * The boolean checks (`canAccessOrg`/`canAccessProject`) are PURE so they're
 * unit-tested; only `computeAccessScope` touches the DB.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

type UserRow = typeof schema.users.$inferSelect;

export type AccessScope =
  | { kind: "all" }
  | { kind: "orgs"; orgIds: string[] }
  | { kind: "projects"; projectIds: string[]; orgIds: string[] };

/** Resolve a user's access scope (queries the roster/ownership). */
export async function computeAccessScope(user: UserRow): Promise<AccessScope> {
  const db = getDb();

  if (user.userType === "client") {
    return { kind: "orgs", orgIds: user.organizationId ? [user.organizationId] : [] };
  }

  // Wahala staff
  if (user.role === "wahala_admin") return { kind: "all" };

  if (user.role === "sales_rep") {
    const ownedDeals = await db
      .select({ id: schema.deals.id, organizationId: schema.deals.organizationId })
      .from(schema.deals)
      .where(eq(schema.deals.ownerUserId, user.id));
    return {
      // Reuse project-scoped semantics with no delivery projects. Sales services
      // additionally filter by Deal owner so another Deal on the same account is
      // never exposed merely because its account context is reachable.
      kind: "projects",
      projectIds: [],
      orgIds: [...new Set(ownedDeals.map((deal) => deal.organizationId).filter((id): id is string => !!id))],
    };
  }

  if (user.role === "account_owner") {
    const owned = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.accountOwnerUserId, user.id));
    return { kind: "orgs", orgIds: owned.map((o) => o.id) };
  }

  // lead_engineer / engineer → projects they lead or are a member of
  const [members, led] = await Promise.all([
    db
      .select({ projectId: schema.projectMembers.projectId, organizationId: schema.projectMembers.organizationId })
      .from(schema.projectMembers)
      .where(eq(schema.projectMembers.userId, user.id)),
    db
      .select({ id: schema.projects.id, organizationId: schema.projects.organizationId })
      .from(schema.projects)
      .where(eq(schema.projects.leadEngineerUserId, user.id)),
  ]);

  const projectIds = [...new Set([...members.map((m) => m.projectId), ...led.map((p) => p.id)])];
  const orgIds = [...new Set([...members.map((m) => m.organizationId), ...led.map((p) => p.organizationId)])];
  return { kind: "projects", projectIds, orgIds };
}

/** May the caller reach anything in this org? (pure) */
export function canAccessOrg(scope: AccessScope, orgId: string): boolean {
  if (scope.kind === "all") return true;
  return scope.orgIds.includes(orgId);
}

/** May the caller reach this specific project? (pure) */
export function canAccessProject(
  scope: AccessScope,
  project: { id: string; organizationId: string },
): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "orgs") return scope.orgIds.includes(project.organizationId);
  return scope.projectIds.includes(project.id);
}

/** Resource-level write boundary for the Wahala commercial roles. */
export function canManageCommercialDeal(
  actor: { userId: string; role: string },
  scope: AccessScope,
  deal: { organizationId: string | null; ownerUserId: string | null },
): boolean {
  if (actor.role === "wahala_admin") return scope.kind === "all";
  if (actor.role === "sales_rep") return deal.ownerUserId === actor.userId;
  if (actor.role !== "account_owner") return false;
  if (deal.organizationId) return canAccessOrg(scope, deal.organizationId);
  return deal.ownerUserId === actor.userId;
}

/**
 * A sales rep's normal account scope comes from Deals they already own. That
 * cannot be the only rule at opportunity creation: a rep may be assigned a
 * contact on an account before they own their first Deal there. Permit that
 * narrowly, while keeping every other account and Deal out of reach.
 */
export function canSalesRepSeedOpportunityOnAccount(input: {
  scope: AccessScope;
  userId: string;
  contactAssignedToUserId: string | null;
  contactOrganizationId: string | null;
  linkedOrganizationIds: string[];
  organizationId: string;
}): boolean {
  if (canAccessOrg(input.scope, input.organizationId)) return true;
  if (input.contactAssignedToUserId !== input.userId) return false;
  return input.contactOrganizationId === input.organizationId || input.linkedOrganizationIds.includes(input.organizationId);
}
