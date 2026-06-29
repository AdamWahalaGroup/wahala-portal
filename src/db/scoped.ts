/**
 * The single tenant-isolation + visibility enforcement seam.
 *
 * Every client-scoped READ goes through here. Three guarantees, applied server-side
 * from the caller's `accessScope` (see src/auth/access.ts):
 *
 *  1. Tenant isolation — match only rows in orgs the caller may reach
 *     (admins: all; account owners: owned orgs; clients: their org).
 *  2. Project scope — project-scoped staff (lead/engineer) match only their
 *     assigned projects, not every project in the org.
 *  3. Visibility — clients never match internal-flagged rows (recordings, AI
 *     digests, internal tasks/messages). Staff see everything in scope.
 *
 * Low-level conditions (`tenant`, `projectScope`, `visible`) are exposed so new
 * readers compose the same filters; concrete readers below are the ergonomic surface.
 */
import { and, eq, inArray, sql, type SQL, type AnyColumn } from "drizzle-orm";
import type { AuthContext } from "@/auth/context";
import { getDb, schema } from "@/db";

export class ScopedDb {
  constructor(private readonly ctx: AuthContext) {}

  private get db() {
    return getDb();
  }

  /** Org-level tenant filter for any table carrying organization_id. */
  tenant(table: { organizationId: AnyColumn }): SQL | undefined {
    const s = this.ctx.accessScope;
    if (s.kind === "all") return undefined;
    if (s.orgIds.length === 0) return sql`0 = 1`; // no orgs in scope → match nothing
    return inArray(table.organizationId, s.orgIds);
  }

  /** Project-level filter for project-scoped staff (engineers/leads); else no-op. */
  projectScope(projectIdColumn: AnyColumn): SQL | undefined {
    const s = this.ctx.accessScope;
    if (s.kind !== "projects") return undefined;
    if (s.projectIds.length === 0) return sql`0 = 1`;
    return inArray(projectIdColumn, s.projectIds);
  }

  /** Visibility filter for a visibility-flagged table. */
  visible(table: { visibility: AnyColumn }): SQL | undefined {
    if (this.ctx.canSeeInternal) return undefined; // staff: see internal too
    return eq(table.visibility, "client_visible");
  }

  // ---- concrete reads (all go through tenant()/projectScope()/visible()) ----

  /** The caller's own organization (clients only; staff aren't a tenant). */
  async currentOrganization() {
    if (!this.ctx.organizationId) return null;
    return this.db.query.organizations.findFirst({
      where: eq(schema.organizations.id, this.ctx.organizationId),
    });
  }

  /** Organizations the caller may act within. */
  async listOrganizations() {
    const s = this.ctx.accessScope;
    if (s.kind === "all") return this.db.select().from(schema.organizations);
    if (s.orgIds.length === 0) return [];
    return this.db
      .select()
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, s.orgIds));
  }

  /** Projects the caller may see. */
  async listProjects() {
    return this.db
      .select()
      .from(schema.projects)
      .where(and(this.tenant(schema.projects), this.projectScope(schema.projects.id)));
  }

  /** A single project the caller may see, or null. */
  async getProject(id: string) {
    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(
        and(this.tenant(schema.projects), this.projectScope(schema.projects.id), eq(schema.projects.id, id)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** Tasks for a project — tenant-, project-, AND visibility-scoped. */
  async listTasks(projectId: string) {
    return this.db
      .select()
      .from(schema.tasks)
      .where(
        and(
          this.tenant(schema.tasks),
          this.projectScope(schema.tasks.projectId),
          this.visible(schema.tasks),
          eq(schema.tasks.projectId, projectId),
        ),
      );
  }

  /** Stages for a project (tenant- + project-scoped), ordered by sequence. */
  async listStages(projectId: string) {
    return this.db
      .select()
      .from(schema.stages)
      .where(
        and(
          this.tenant(schema.stages),
          this.projectScope(schema.stages.projectId),
          eq(schema.stages.projectId, projectId),
        ),
      )
      .orderBy(schema.stages.sequence);
  }

  /** A single stage the caller may see, or null. */
  async getStage(id: string) {
    const rows = await this.db
      .select()
      .from(schema.stages)
      .where(
        and(this.tenant(schema.stages), this.projectScope(schema.stages.projectId), eq(schema.stages.id, id)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  /** Line items for a stage, gated through the parent stage's scope. */
  async listStageLineItems(stageId: string) {
    const stage = await this.getStage(stageId);
    if (!stage) return [];
    return this.db
      .select()
      .from(schema.stageLineItems)
      .where(eq(schema.stageLineItems.stageId, stageId))
      .orderBy(schema.stageLineItems.sortOrder);
  }
}

export function scopedDb(ctx: AuthContext): ScopedDb {
  return new ScopedDb(ctx);
}
