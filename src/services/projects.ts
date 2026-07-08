/**
 * Project service. Mirrors the stages service shape: authorize → write + audit.
 * (Reuses StageError as the generic domain error — its codes are generic.)
 */
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessOrg, canAccessProject } from "@/auth/access";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import { createStage } from "@/services/stages";
import { accountKey, postMessage } from "@/services/messages";

type Project = typeof schema.projects.$inferSelect;

export type ProjectDetail = {
  project: Project;
  organizationName: string;
  accountOwner: { name: string } | null;
  leadEngineer: { name: string } | null;
  roster: { id: string; name: string; role: string }[];
};

/** A project + its people (owner / lead / roster), tenant-scoped. */
export async function getProjectDetail(ctx: AuthContext, id: string): Promise<ProjectDetail> {
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  if (!canAccessProject(ctx.accessScope, { id: project.id, organizationId: project.organizationId })) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "load_project",
      resource: `project:${project.id}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Project not found.");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, project.organizationId),
  });
  const members = await db
    .select({ userId: schema.projectMembers.userId, role: schema.projectMembers.projectRole })
    .from(schema.projectMembers)
    .where(eq(schema.projectMembers.projectId, id));

  const ids = [org?.accountOwnerUserId, project.leadEngineerUserId, ...members.map((m) => m.userId)].filter(
    Boolean,
  ) as string[];
  const users = ids.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids))
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    project,
    organizationName: org?.name ?? "—",
    accountOwner: org?.accountOwnerUserId ? { name: nameById.get(org.accountOwnerUserId) ?? "—" } : null,
    leadEngineer: project.leadEngineerUserId ? { name: nameById.get(project.leadEngineerUserId) ?? "—" } : null,
    roster: members.map((m) => ({ id: m.userId, name: nameById.get(m.userId) ?? "—", role: m.role })),
  };
}

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

  if (!canAccessOrg(ctx.accessScope, org.id)) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "create_project",
      resource: `org:${org.id}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Organization not found.");
  }

  const isOwner = ctx.user.id === org.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "create_project",
      resource: `org:${org.id}`,
      reason: "not_admin_or_owner",
    });
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

/**
 * Persist an AI-drafted project: project row (+ ai_context_md) → N draft stages with
 * epic-grouped deliverables (no prices) → optional first message on the account thread
 * → append a dated section to the per-client AI memory. RBAC is enforced by the inner
 * createProject/createStage calls.
 */
export async function createDraftedProject(
  ctx: AuthContext,
  input: {
    organizationId: string;
    name: string;
    description?: string;
    workType?: string;
    aiContextMd?: string;
    stages: { name: string; scopeDescription?: string; deliverables: { epic: string; description: string }[]; totalAmountCents?: number }[];
    clientMessage?: string;
    postToThread?: boolean;
  },
): Promise<{ projectId: string }> {
  const project = await createProject(ctx, {
    organizationId: input.organizationId,
    name: input.name,
    description: input.description,
    workType: input.workType,
  });

  const db = getDb();
  if (input.aiContextMd?.trim()) {
    await db
      .update(schema.projects)
      .set({ aiContextMd: input.aiContextMd.trim() })
      .where(eq(schema.projects.id, project.id));
  }

  for (const s of input.stages) {
    await createStage(ctx, {
      projectId: project.id,
      name: s.name,
      scopeDescription: s.scopeDescription,
      totalAmountCents: s.totalAmountCents ?? 0,
      lineItems: s.deliverables.map((d) => ({ description: d.description, groupLabel: d.epic })),
    });
  }

  // Append (or seed) the per-client AI memory with a dated section for this project.
  const orgRow = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, input.organizationId),
  });
  const appended = appendClientMemo(orgRow?.aiContextMd ?? null, input.name, input.description);
  await db
    .update(schema.organizations)
    .set({ aiContextMd: appended })
    .where(eq(schema.organizations.id, input.organizationId));

  if (input.postToThread && input.clientMessage?.trim()) {
    await postMessage(ctx, { threadKey: accountKey(input.organizationId), body: input.clientMessage.trim() });
  }

  return { projectId: project.id };
}

function appendClientMemo(existing: string | null, projectName: string, description: string | undefined): string {
  const iso = new Date().toISOString().slice(0, 10);
  const block = `## ${projectName} — drafted ${iso}\n${(description ?? "").trim()}`.trim();
  const prior = existing?.trim();
  return prior ? `${prior}\n\n${block}\n` : `# Client memory\n\n${block}\n`;
}
