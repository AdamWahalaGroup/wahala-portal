/**
 * Auth context — resolve the current request's signed-in user and the
 * coarse authorization facts the scoped-query layer keys off.
 *
 * Authentication is Cloudflare magic-link; AUTHORIZATION is ours (orgs/roles in
 * the DB). Phase 0 establishes the seam: staff vs. client, all-orgs vs. one org,
 * internal-visible vs. client-visible. Phase 1 refines per-role (e.g. an engineer
 * sees only assigned work) — without moving the enforcement point.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readSessionCookie, getSessionUserId } from "@/auth/session";
import { computeAccessScope, type AccessScope } from "@/auth/access";
import { isDemoMode, DEMO_USER_ID } from "@/auth/demo";

export type AuthUser = typeof schema.users.$inferSelect;

export type AuthContext = {
  user: AuthUser;
  isStaff: boolean; // Wahala team member (organizationId === null)
  isAdmin: boolean; // wahala_admin
  organizationId: string | null; // the user's tenant; null for staff
  accessScope: AccessScope; // which orgs/projects this user may reach (the scoping seam)
  canSeeAllOrgs: boolean; // derived: accessScope.kind === "all"
  canSeeInternal: boolean; // staff see internal-flagged rows; clients never do
};

/** Resolve the current auth context, or null if not signed in. */
export async function getAuthContext(): Promise<AuthContext | null> {
  // Demo deployment (isolated worker + fixture-only DB): every request is the
  // seeded viewer — no session, no cookies. Writes are refused at getDb().
  if (isDemoMode()) {
    const db = getDb();
    const user =
      (await db.query.users.findFirst({ where: eq(schema.users.id, DEMO_USER_ID) })) ??
      (await db.query.users.findFirst({
        where: and(eq(schema.users.userType, "wahala"), eq(schema.users.role, "wahala_admin"), eq(schema.users.status, "active")),
      }));
    if (!user) return null;
    const accessScope = await computeAccessScope(user);
    return {
      user,
      isStaff: true,
      isAdmin: true,
      organizationId: null,
      accessScope,
      canSeeAllOrgs: accessScope.kind === "all",
      canSeeInternal: true,
    };
  }

  const raw = await readSessionCookie();
  if (!raw) return null;

  const userId = await getSessionUserId(raw);
  if (!userId) return null;

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  if (!user || user.status === "disabled") return null;

  const isStaff = user.userType === "wahala";
  const accessScope = await computeAccessScope(user);
  return {
    user,
    isStaff,
    isAdmin: user.role === "wahala_admin",
    organizationId: user.organizationId,
    accessScope,
    canSeeAllOrgs: accessScope.kind === "all",
    canSeeInternal: isStaff,
  };
}
