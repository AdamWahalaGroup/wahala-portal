/**
 * Auth context — resolve the current request's signed-in user and the
 * coarse authorization facts the scoped-query layer keys off.
 *
 * Authentication is Cloudflare magic-link; AUTHORIZATION is ours (orgs/roles in
 * the DB). Phase 0 establishes the seam: staff vs. client, all-orgs vs. one org,
 * internal-visible vs. client-visible. Phase 1 refines per-role (e.g. an engineer
 * sees only assigned work) — without moving the enforcement point.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readSessionCookie, getSessionUserId } from "@/auth/session";

export type AuthUser = typeof schema.users.$inferSelect;

export type AuthContext = {
  user: AuthUser;
  isStaff: boolean; // Wahala team member (organizationId === null)
  isAdmin: boolean; // wahala_admin
  organizationId: string | null; // the user's tenant; null for staff
  canSeeAllOrgs: boolean; // Phase 0: staff see every org's data
  canSeeInternal: boolean; // Phase 0: staff see internal-flagged rows; clients never do
};

/** Resolve the current auth context, or null if not signed in. */
export async function getAuthContext(): Promise<AuthContext | null> {
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
  return {
    user,
    isStaff,
    isAdmin: user.role === "wahala_admin",
    organizationId: user.organizationId,
    canSeeAllOrgs: isStaff,
    canSeeInternal: isStaff,
  };
}
