/**
 * The single tenant-isolation + visibility enforcement seam.
 *
 * Every client-scoped READ goes through here. Two guarantees, applied server-side:
 *
 *  1. Tenant isolation — a client user only ever matches rows where
 *     organization_id = their org. Wahala staff match all orgs (Phase 0; per-role
 *     narrowing, e.g. engineers seeing only assigned work, lands in Phase 1 here).
 *
 *  2. Visibility — a client user never matches internal-flagged rows (meeting
 *     recordings, AI digests, internal tasks/messages). Staff see everything.
 *
 * Low-level conditions (`tenant`, `visible`) are exposed so new readers compose the
 * same filters; concrete readers below are the ergonomic surface the app calls.
 */
import { and, eq, type SQL, type AnyColumn } from "drizzle-orm";
import type { AuthContext } from "@/auth/context";
import { getDb, schema } from "@/db";

export class ScopedDb {
  constructor(private readonly ctx: AuthContext) {}

  private get db() {
    return getDb();
  }

  /** Mandatory tenant filter for any table carrying organization_id. */
  tenant(table: { organizationId: AnyColumn }): SQL | undefined {
    if (this.ctx.canSeeAllOrgs) return undefined; // staff: no org constraint
    return eq(table.organizationId, this.ctx.organizationId!);
  }

  /** Mandatory visibility filter for a visibility-flagged table. */
  visible(table: { visibility: AnyColumn }): SQL | undefined {
    if (this.ctx.canSeeInternal) return undefined; // staff: see internal too
    return eq(table.visibility, "client_visible");
  }

  // ---- concrete reads (extend per phase; all go through tenant()/visible()) ----

  /** The caller's own organization. Staff aren't tenants → null. */
  async currentOrganization() {
    if (this.ctx.canSeeAllOrgs || !this.ctx.organizationId) return null;
    return this.db.query.organizations.findFirst({
      where: eq(schema.organizations.id, this.ctx.organizationId),
    });
  }

  /** Projects the caller may see (tenant-scoped). */
  async listProjects() {
    return this.db
      .select()
      .from(schema.projects)
      .where(this.tenant(schema.projects));
  }

  /** Tasks for a project — tenant- AND visibility-scoped. */
  async listTasks(projectId: string) {
    return this.db
      .select()
      .from(schema.tasks)
      .where(
        and(
          this.tenant(schema.tasks),
          this.visible(schema.tasks),
          eq(schema.tasks.projectId, projectId),
        ),
      );
  }
}

export function scopedDb(ctx: AuthContext): ScopedDb {
  return new ScopedDb(ctx);
}
