/**
 * Handoff service (R5 — the B-team layer). Adam + Jason run lead → contract; the
 * delivery team picks up here: assemble the roster on the project, AI-break each
 * phase's SOW deliverables into internal tasks, and the "next ADD whim with the
 * next customer" can start. Tasks land INTERNAL (clients see stories/deliverables,
 * not the task list) and unassigned — the lead spreads them across the team.
 */
import { eq, inArray, and } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { generateTaskBreakdown } from "@/services/ai/taskgen";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import type { DraftUsage } from "@/services/ai/provider";
import { recordAiRun } from "@/services/ai/usage";

/**
 * AI-break one phase's deliverables into internal tasks. Admin or the project's
 * lead engineer (same tier that manages tasks). Appends — running it twice adds
 * more tasks; delete the extras (draft phases allow task deletion).
 */
export async function generateTasksForStage(
  ctx: AuthContext,
  stageId: string,
): Promise<{ created: number; usage: DraftUsage }> {
  const db = getDb();
  const stage = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
  if (!stage) throw new StageError("NOT_FOUND", "Phase not found.");
  const scope = ctx.accessScope;
  if (!ctx.isStaff || (scope.kind !== "all" && !scope.orgIds.includes(stage.organizationId))) {
    throw new StageError("NOT_FOUND", "Phase not found.");
  }
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, stage.projectId) });
  if (!(ctx.isAdmin || (project?.leadEngineerUserId && project.leadEngineerUserId === ctx.user.id))) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "generate_tasks", resource: `stage:${stageId}`, reason: "not_admin_or_lead" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or the project's lead can generate tasks.");
  }

  const [lineItems, org] = await Promise.all([
    db
      .select()
      .from(schema.stageLineItems)
      .where(eq(schema.stageLineItems.stageId, stageId))
      .orderBy(schema.stageLineItems.sortOrder),
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, stage.organizationId) }),
  ]);
  if (lineItems.length === 0) {
    throw new StageError("VALIDATION", "This phase has no deliverables yet — there's nothing to break down.");
  }

  const { tasks, usage } = await generateTaskBreakdown({
    phaseName: stage.name,
    scopeDescription: stage.scopeDescription,
    deliverables: lineItems.map((li) => ({ groupLabel: li.groupLabel, description: li.description })),
    projectDescription: project?.description ?? null,
    projectContextMd: project?.aiContextMd ?? null,
    clientMemoryMd: org?.aiContextMd ?? null,
  });
  await recordAiRun(db, { agentKey: "taskgen", organizationId: stage.organizationId, ...usage });

  const statements: BatchItem<"sqlite">[] = [];
  for (const t of tasks) {
    const taskId = crypto.randomUUID();
    statements.push(
      db.insert(schema.tasks).values({
        id: taskId,
        organizationId: stage.organizationId,
        projectId: stage.projectId,
        stageId,
        stageLineItemId: t.deliverableIndex >= 0 ? lineItems[t.deliverableIndex].id : null,
        title: t.title.trim(),
        description: t.description?.trim() || null,
        status: "todo",
        visibility: "internal", // clients see stories, not the engineering task list
        aiAssisted: true,
        createdByUserId: ctx.user.id,
      }),
    );
    t.subtasks.slice(0, 6).forEach((s, i) => {
      if (s.trim()) {
        statements.push(db.insert(schema.taskSubtasks).values({ taskId, title: s.trim(), sortOrder: i }));
      }
    });
  }
  statements.push(
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: stage.organizationId,
        actorUserId: ctx.user.id,
        action: "stage.tasks_generated",
        entityType: "stage",
        entityId: stageId,
        metadata: { created: tasks.length, model: usage.model, costCents: usage.costCents },
      }),
    ),
  );
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);

  return { created: tasks.length, usage };
}

/**
 * Assemble (or reshuffle) the delivery team: lead engineer + roster. Admin or
 * account owner — handing off is a management act. Replaces the existing roster.
 */
export async function setProjectTeam(
  ctx: AuthContext,
  projectId: string,
  input: { leadEngineerUserId: string | null; engineerIds: string[] },
): Promise<void> {
  if (!ctx.isStaff || !(ctx.isAdmin || ctx.user.role === "account_owner")) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "set_project_team", reason: "not_admin_or_owner" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or account owner can hand a project off.");
  }
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(project.organizationId)) {
    throw new StageError("NOT_FOUND", "Project not found.");
  }

  const wanted = [...new Set([input.leadEngineerUserId, ...input.engineerIds].filter((v): v is string => !!v))];
  if (wanted.length > 0) {
    const staff = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(inArray(schema.users.id, wanted), eq(schema.users.userType, "wahala")));
    if (staff.length !== wanted.length) {
      throw new StageError("VALIDATION", "The team can only contain Wahala staff.");
    }
  }

  const memberRows = wanted.map((userId) => ({
    organizationId: project.organizationId,
    projectId,
    userId,
    projectRole: (userId === input.leadEngineerUserId ? "lead" : "engineer") as "lead" | "engineer",
  }));

  const statements: BatchItem<"sqlite">[] = [
    db.update(schema.projects).set({ leadEngineerUserId: input.leadEngineerUserId }).where(eq(schema.projects.id, projectId)),
    db.delete(schema.projectMembers).where(eq(schema.projectMembers.projectId, projectId)),
  ];
  if (memberRows.length > 0) statements.push(db.insert(schema.projectMembers).values(memberRows));
  statements.push(
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: project.organizationId,
        actorUserId: ctx.user.id,
        action: "project.handed_off",
        entityType: "project",
        entityId: projectId,
        metadata: { leadEngineerUserId: input.leadEngineerUserId, teamSize: memberRows.length },
      }),
    ),
  );
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}
