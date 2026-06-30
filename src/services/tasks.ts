/**
 * Tasks — the delivery layer. Wahala (admin / project lead) adds tasks to a stage
 * and assigns them; engineers update status; a task assigned to the client surfaces
 * as their "on you" item. Clients are READ-ONLY and never see internal-flagged tasks.
 *
 * Visibility is enforced here (and is the first screen to exercise the rule):
 * a client read only ever returns client_visible tasks.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessProject } from "@/auth/access";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done", "cancelled"];

export type Subtask = { id: string; title: string; done: boolean };
export type TaskNote = { id: string; author: string; body: string; createdAt: Date };

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  visibility: "client_visible" | "internal";
  assignee: { name: string; type: "wahala" | "client" | "ai" } | null;
  deliverableId: string | null;
  subtasks: Subtask[];
  notes: TaskNote[];
};

export type AssignablePerson = { id: string; name: string; type: "wahala" | "client" };

/** Load a stage + its project, tenant/project-scoped (throws NOT_FOUND out of scope). */
async function loadStageProject(ctx: AuthContext, stageId: string) {
  const db = getDb();
  const stage = await db.query.stages.findFirst({
    where: eq(schema.stages.id, stageId),
    with: { project: true },
  });
  if (!stage) throw new StageError("NOT_FOUND", "Stage not found.");
  if (!canAccessProject(ctx.accessScope, { id: stage.projectId, organizationId: stage.organizationId })) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "load_stage_tasks",
      resource: `stage:${stageId}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Stage not found.");
  }
  return stage;
}

/** Admin, or the project's lead engineer, may add/assign tasks. */
function canManageTasks(ctx: AuthContext, leadEngineerUserId: string | null | undefined): boolean {
  return ctx.isAdmin || (!!leadEngineerUserId && ctx.user.id === leadEngineerUserId);
}

/** Tasks for a stage — visibility-scoped (clients never see internal tasks). */
export async function listTasksForStage(ctx: AuthContext, stageId: string): Promise<TaskView[]> {
  await loadStageProject(ctx, stageId);
  const db = getDb();

  const conds = [eq(schema.tasks.stageId, stageId)];
  if (!ctx.canSeeInternal) conds.push(eq(schema.tasks.visibility, "client_visible"));
  const rows = await db.select().from(schema.tasks).where(and(...conds)).orderBy(schema.tasks.createdAt);
  if (rows.length === 0) return [];

  const taskIds = rows.map((r) => r.id);
  const [assignments, subtaskRows, noteRows] = await Promise.all([
    db.select().from(schema.taskAssignments).where(inArray(schema.taskAssignments.taskId, taskIds)),
    db.select().from(schema.taskSubtasks).where(inArray(schema.taskSubtasks.taskId, taskIds)).orderBy(schema.taskSubtasks.sortOrder),
    db.select().from(schema.taskNotes).where(inArray(schema.taskNotes.taskId, taskIds)).orderBy(schema.taskNotes.createdAt),
  ]);

  // Names for assignees + note authors in one lookup.
  const userIds = [
    ...new Set([
      ...assignments.map((a) => a.assigneeUserId),
      ...noteRows.map((n) => n.authorUserId),
    ].filter(Boolean)),
  ] as string[];
  const users = userIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds))
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const firstByTask = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) if (!firstByTask.has(a.taskId)) firstByTask.set(a.taskId, a);

  const subtasksByTask = new Map<string, Subtask[]>();
  for (const s of subtaskRows) {
    const arr = subtasksByTask.get(s.taskId) ?? [];
    arr.push({ id: s.id, title: s.title, done: s.done });
    subtasksByTask.set(s.taskId, arr);
  }
  const notesByTask = new Map<string, TaskNote[]>();
  for (const n of noteRows) {
    const arr = notesByTask.get(n.taskId) ?? [];
    arr.push({ id: n.id, author: n.authorUserId ? nameById.get(n.authorUserId) ?? "—" : "—", body: n.body, createdAt: n.createdAt });
    notesByTask.set(n.taskId, arr);
  }

  return rows.map((r) => {
    const a = firstByTask.get(r.id);
    const assignee = a
      ? {
          name: a.assigneeUserId ? nameById.get(a.assigneeUserId) ?? "—" : a.assigneeType === "ai" ? "AI" : "—",
          type: a.assigneeType,
        }
      : null;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status as TaskStatus,
      visibility: r.visibility as "client_visible" | "internal",
      assignee,
      deliverableId: r.stageLineItemId ?? null,
      subtasks: subtasksByTask.get(r.id) ?? [],
      notes: notesByTask.get(r.id) ?? [],
    };
  });
}

/** People a staff member can assign a stage's task to: the roster + client contacts. */
export async function assignableForStage(ctx: AuthContext, stageId: string): Promise<AssignablePerson[]> {
  const stage = await loadStageProject(ctx, stageId);
  if (!ctx.isStaff) return [];
  const db = getDb();

  const members = await db
    .select({ userId: schema.projectMembers.userId })
    .from(schema.projectMembers)
    .where(eq(schema.projectMembers.projectId, stage.projectId));
  const wahalaIds = new Set<string>(members.map((m) => m.userId));
  if (stage.project?.leadEngineerUserId) wahalaIds.add(stage.project.leadEngineerUserId);
  wahalaIds.add(ctx.user.id);

  const wahala = wahalaIds.size
    ? await db
        .select({ id: schema.users.id, name: schema.users.name, userType: schema.users.userType })
        .from(schema.users)
        .where(inArray(schema.users.id, [...wahalaIds]))
    : [];
  const clients = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.organizationId, stage.organizationId), eq(schema.users.userType, "client")));

  return [
    ...wahala.filter((u) => u.userType === "wahala").map((u) => ({ id: u.id, name: u.name, type: "wahala" as const })),
    ...clients.map((u) => ({ id: u.id, name: u.name, type: "client" as const })),
  ];
}

/** Create a task on a stage (admin / project lead only). */
export async function createTask(
  ctx: AuthContext,
  input: { stageId: string; title: string; description?: string; visibility?: string; assigneeUserId?: string; stageLineItemId?: string },
): Promise<void> {
  const stage = await loadStageProject(ctx, input.stageId);
  if (!canManageTasks(ctx, stage.project?.leadEngineerUserId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "create_task", resource: `stage:${input.stageId}`, reason: "not_admin_or_lead" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or the project's lead can add tasks.");
  }
  const title = input.title?.trim();
  if (!title) throw new StageError("VALIDATION", "Task title is required.");
  const visibility = input.visibility === "internal" ? "internal" : "client_visible";

  const db = getDb();
  const taskId = crypto.randomUUID();
  const stmts: unknown[] = [
    db.insert(schema.tasks).values({
      id: taskId,
      organizationId: stage.organizationId,
      projectId: stage.projectId,
      stageId: input.stageId,
      stageLineItemId: input.stageLineItemId || null,
      title,
      description: input.description?.trim() || null,
      status: "todo",
      visibility,
      createdByUserId: ctx.user.id,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: stage.organizationId,
        actorUserId: ctx.user.id,
        action: "task.created",
        entityType: "task",
        entityId: taskId,
        metadata: { title, visibility },
      }),
    ),
  ];

  if (input.assigneeUserId) {
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, input.assigneeUserId) });
    if (u && (u.organizationId === stage.organizationId || u.userType === "wahala")) {
      stmts.push(
        db.insert(schema.taskAssignments).values({
          taskId,
          assigneeUserId: u.id,
          assigneeType: u.userType === "client" ? "client" : "wahala",
        }),
      );
    }
  }

  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
}

/** Update a task's status (admin, project lead, or the assignee — staff only). */
export async function updateTaskStatus(ctx: AuthContext, taskId: string, status: string): Promise<void> {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    throw new StageError("VALIDATION", "Unknown task status.");
  }
  const db = getDb();
  const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId), with: { project: true } });
  if (!task) throw new StageError("NOT_FOUND", "Task not found.");
  if (!canAccessProject(ctx.accessScope, { id: task.projectId, organizationId: task.organizationId })) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "task_status", resource: `task:${taskId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Task not found.");
  }

  const isLead = task.project?.leadEngineerUserId === ctx.user.id;
  let isAssignee = false;
  if (ctx.isStaff && !ctx.isAdmin && !isLead) {
    const a = await db
      .select({ id: schema.taskAssignments.id })
      .from(schema.taskAssignments)
      .where(and(eq(schema.taskAssignments.taskId, taskId), eq(schema.taskAssignments.assigneeUserId, ctx.user.id)))
      .limit(1);
    isAssignee = a.length > 0;
  }
  if (!ctx.isStaff || !(ctx.isAdmin || isLead || isAssignee)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "task_status", resource: `task:${taskId}`, reason: "not_permitted" });
    throw new StageError("FORBIDDEN", "You can't change this task's status.");
  }

  await db.batch([
    db.update(schema.tasks).set({ status: status as TaskStatus, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: task.organizationId,
        actorUserId: ctx.user.id,
        action: "task.status",
        entityType: "task",
        entityId: taskId,
        metadata: { status },
      }),
    ),
  ]);
}

/** Load a task + authorize manage (admin or the project's lead). Tenant-scoped. */
async function loadTaskForManage(ctx: AuthContext, taskId: string) {
  const db = getDb();
  const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId), with: { project: true } });
  if (!task) throw new StageError("NOT_FOUND", "Task not found.");
  if (!canAccessProject(ctx.accessScope, { id: task.projectId, organizationId: task.organizationId })) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "task_child", resource: `task:${taskId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Task not found.");
  }
  if (!canManageTasks(ctx, task.project?.leadEngineerUserId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "task_child", resource: `task:${taskId}`, reason: "not_admin_or_lead" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or the project's lead can edit this task.");
  }
  return task;
}

/** Delete a task (admin/lead) — only before the quote is sent (stage still draft). */
export async function deleteTask(ctx: AuthContext, taskId: string): Promise<void> {
  const task = await loadTaskForManage(ctx, taskId);
  const db = getDb();
  const stage = task.stageId ? await db.query.stages.findFirst({ where: eq(schema.stages.id, task.stageId) }) : null;
  if (!stage || stage.status !== "draft") {
    throw new StageError("INVALID_STATE", "Tasks can only be deleted before the quote is sent.");
  }
  await db.batch([
    db.delete(schema.taskAssignments).where(eq(schema.taskAssignments.taskId, taskId)),
    db.delete(schema.taskSubtasks).where(eq(schema.taskSubtasks.taskId, taskId)),
    db.delete(schema.taskNotes).where(eq(schema.taskNotes.taskId, taskId)),
    db.delete(schema.tasks).where(eq(schema.tasks.id, taskId)),
    db.insert(schema.auditLog).values(
      buildAudit({ organizationId: task.organizationId, actorUserId: ctx.user.id, action: "task.deleted", entityType: "task", entityId: taskId, metadata: { title: task.title } }),
    ),
  ]);
}

/** Add a subtask (checklist item) to a task. Admin/lead only. */
export async function addSubtask(ctx: AuthContext, taskId: string, title: string): Promise<void> {
  await loadTaskForManage(ctx, taskId);
  const t = title?.trim();
  if (!t) throw new StageError("VALIDATION", "Subtask title is required.");
  const db = getDb();
  const existing = await db.select({ id: schema.taskSubtasks.id }).from(schema.taskSubtasks).where(eq(schema.taskSubtasks.taskId, taskId));
  await db.insert(schema.taskSubtasks).values({ taskId, title: t, sortOrder: existing.length });
}

/** Toggle a subtask's done flag. Admin/lead only. */
export async function setSubtaskDone(ctx: AuthContext, taskId: string, subtaskId: string, done: boolean): Promise<void> {
  await loadTaskForManage(ctx, taskId);
  const db = getDb();
  await db
    .update(schema.taskSubtasks)
    .set({ done: !!done })
    .where(and(eq(schema.taskSubtasks.id, subtaskId), eq(schema.taskSubtasks.taskId, taskId)));
}

/** Delete a subtask. Admin/lead only. */
export async function removeSubtask(ctx: AuthContext, taskId: string, subtaskId: string): Promise<void> {
  await loadTaskForManage(ctx, taskId);
  const db = getDb();
  await db.delete(schema.taskSubtasks).where(and(eq(schema.taskSubtasks.id, subtaskId), eq(schema.taskSubtasks.taskId, taskId)));
}

/** Append a worklog note ("what was done") to a task. Admin/lead only. */
export async function addNote(ctx: AuthContext, taskId: string, body: string): Promise<void> {
  await loadTaskForManage(ctx, taskId);
  const b = body?.trim();
  if (!b) throw new StageError("VALIDATION", "A note can't be empty.");
  const db = getDb();
  await db.insert(schema.taskNotes).values({ taskId, authorUserId: ctx.user.id, body: b });
}
