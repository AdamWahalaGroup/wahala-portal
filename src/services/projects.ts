/**
 * Project service. Mirrors the stages service shape: authorize → write + audit.
 * (Reuses StageError as the generic domain error — its codes are generic.)
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";

type Project = typeof schema.projects.$inferSelect;

/** Create a project under an org. Wahala admin, or that org's Account Owner. */
export async function createProject(
  ctx: AuthContext,
  input: {
    organizationId: string;
    name: string;
    description?: string;
    workType?: string;
    leadEngineerUserId?: string;
  },
): Promise<Project> {
  const db = getDb();
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, input.organizationId),
  });
  if (!org) throw new StageError("NOT_FOUND", "Organization not found.");

  const isOwner = ctx.user.id === org.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
    throw new StageError("FORBIDDEN", "Only a Wahala admin or the Account Owner can create a project.");
  }

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(schema.projects).values({
      id,
      organizationId: org.id,
      name: input.name,
      description: input.description ?? null,
      workType: input.workType ?? null,
      leadEngineerUserId: input.leadEngineerUserId ?? null,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: org.id,
        actorUserId: ctx.user.id,
        action: "project.created",
        entityType: "project",
        entityId: id,
        metadata: { name: input.name },
      }),
    ),
  ]);

  const created = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  return created!;
}
