/**
 * Deliverable progress — once a stage's work is underway (paid+), the assigned Wahala
 * staff (admin, the org's Account Owner, or the project's Lead Engineer) can mark each
 * deliverable complete and append client-visible progress notes. Notes are tied to the
 * client-facing deliverable, so the client sees them (the internal worklog lives on
 * tasks instead).
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scopedDb } from "@/db/scoped";
import type { AuthContext } from "@/auth/context";
import { canAccessProject } from "@/auth/access";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

export type DeliverableNote = { id: string; author: string; body: string; createdAt: Date };
export type DeliverableView = {
  id: string;
  groupLabel: string | null;
  description: string;
  completed: boolean;
  completedAt: Date | null;
  notes: DeliverableNote[];
};

/** Deliverables for a stage (tenant-scoped) with completion + progress notes. */
export async function listDeliverablesForStage(ctx: AuthContext, stageId: string): Promise<DeliverableView[]> {
  const stage = await scopedDb(ctx).getStage(stageId);
  if (!stage) return [];
  const db = getDb();

  const items = await db
    .select()
    .from(schema.stageLineItems)
    .where(eq(schema.stageLineItems.stageId, stageId))
    .orderBy(schema.stageLineItems.sortOrder);
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const notes = await db
    .select()
    .from(schema.deliverableNotes)
    .where(inArray(schema.deliverableNotes.stageLineItemId, itemIds))
    .orderBy(schema.deliverableNotes.createdAt);

  const authorIds = [...new Set(notes.map((n) => n.authorUserId).filter(Boolean))] as string[];
  const authors = authorIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, authorIds))
    : [];
  const nameById = new Map(authors.map((u) => [u.id, u.name]));

  const byItem = new Map<string, DeliverableNote[]>();
  for (const n of notes) {
    const arr = byItem.get(n.stageLineItemId) ?? [];
    arr.push({ id: n.id, author: n.authorUserId ? nameById.get(n.authorUserId) ?? "—" : "—", body: n.body, createdAt: n.createdAt });
    byItem.set(n.stageLineItemId, arr);
  }

  return items.map((i) => ({
    id: i.id,
    groupLabel: i.groupLabel,
    description: i.description,
    completed: i.completed,
    completedAt: i.completedAt,
    notes: byItem.get(i.id) ?? [],
  }));
}

/** Whether `ctx` may update a stage's deliverables right now (= show the controls). */
export function canManageDeliverables(
  ctx: AuthContext,
  stage: { status: string; paidAt: Date | number | null | undefined },
  resource: { accountOwnerUserId: string | null; projectLeadUserId: string | null },
): boolean {
  if (!ctx.isStaff || !stage.paidAt) return false; // only once work is underway (paid+)
  return ctx.isAdmin || ctx.user.id === resource.accountOwnerUserId || ctx.user.id === resource.projectLeadUserId;
}

/** Load a deliverable + authorize manage (admin / account owner / lead; stage paid+). */
async function loadForManage(ctx: AuthContext, deliverableId: string) {
  const db = getDb();
  const item = await db.query.stageLineItems.findFirst({ where: eq(schema.stageLineItems.id, deliverableId) });
  if (!item) throw new StageError("NOT_FOUND", "Deliverable not found.");
  const stage = await db.query.stages.findFirst({ where: eq(schema.stages.id, item.stageId), with: { project: true } });
  if (!stage) throw new StageError("NOT_FOUND", "Deliverable not found.");
  if (!canAccessProject(ctx.accessScope, { id: stage.projectId, organizationId: stage.organizationId })) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "deliverable_manage", resource: `deliverable:${deliverableId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Deliverable not found.");
  }
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, stage.organizationId) });
  const resource = { accountOwnerUserId: org?.accountOwnerUserId ?? null, projectLeadUserId: stage.project?.leadEngineerUserId ?? null };
  if (!canManageDeliverables(ctx, stage, resource)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "deliverable_manage", resource: `deliverable:${deliverableId}`, reason: "not_permitted" });
    if (!stage.paidAt) throw new StageError("INVALID_STATE", "Work hasn't started on this stage yet.");
    throw new StageError("FORBIDDEN", "Only the assigned Wahala staff can update this deliverable.");
  }
  return { item, stage };
}

async function audit(orgId: string, actorUserId: string, action: string, entityId: string, metadata: unknown) {
  try {
    await getDb().insert(schema.auditLog).values(buildAudit({ organizationId: orgId, actorUserId, action, entityType: "deliverable", entityId, metadata }));
  } catch {
    /* best-effort; the state change is the source of truth */
  }
}

/** Mark a deliverable complete / not complete (assigned Wahala staff). */
export async function setDeliverableCompleted(ctx: AuthContext, deliverableId: string, completed: boolean): Promise<void> {
  const { item, stage } = await loadForManage(ctx, deliverableId);
  await getDb()
    .update(schema.stageLineItems)
    .set({ completed: !!completed, completedAt: completed ? new Date() : null, completedByUserId: completed ? ctx.user.id : null })
    .where(eq(schema.stageLineItems.id, deliverableId));
  await audit(stage.organizationId, ctx.user.id, completed ? "deliverable.completed" : "deliverable.reopened", deliverableId, { description: item.description });
}

/** Append a progress note to a deliverable (client-visible). */
export async function addDeliverableNote(ctx: AuthContext, deliverableId: string, body: string): Promise<void> {
  const { stage } = await loadForManage(ctx, deliverableId);
  const b = body?.trim();
  if (!b) throw new StageError("VALIDATION", "A note can't be empty.");
  await getDb().insert(schema.deliverableNotes).values({ stageLineItemId: deliverableId, authorUserId: ctx.user.id, body: b });
  await audit(stage.organizationId, ctx.user.id, "deliverable.note", deliverableId, { note: b });
}
