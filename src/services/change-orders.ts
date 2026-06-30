/**
 * Change orders — the client's "I want to make a change" path. A change order is a
 * mini approve/pay lifecycle parallel to a stage, on the (previously unused)
 * change_orders table. It may be priced $0 (absorbed) or billable.
 *
 * Lifecycle (reusing the STAGE_STATUSES enum, documented mapping):
 *   draft (= requested by client) → quoted (Wahala priced; $0 allowed)
 *     → approved (client) → paid (only if billable) → accepted (= applied)
 *   draft|quoted → rejected (declined)
 *
 * Mirrors the stage action machine: tenant-scoped load → role check → compare-and-swap
 * UPDATE … WHERE status = <from> → best-effort audit.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scopedDb } from "@/db/scoped";
import type { AuthContext } from "@/auth/context";
import { canAccessProject } from "@/auth/access";
import { StageError, requiresAdminApproval, type StageStatus } from "@/domain/stage-machine";
import { adminApprovalThresholdCents } from "@/auth/server-env";
import { buildAudit, type AuditInput } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

type ChangeOrder = typeof schema.changeOrders.$inferSelect;
type Db = ReturnType<typeof getDb>;

export type ChangeAction = "send_quote" | "approve" | "reject" | "mark_paid" | "apply" | "decline";

export type ChangeOrderView = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalAmountCents: number;
  requiresAdminApproval: boolean;
  taskId: string | null;
  actions: ChangeAction[];
};

const CLIENT_APPROVER_ROLES = new Set(["client_admin", "client_billing"]);

async function recordChange(db: Db, ctx: AuthContext, audit: AuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLog).values(buildAudit(audit));
  } catch (err) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: `audit_write_failed:${audit.action}`, reason: String(err) });
  }
}

/** Load a change order + its org, tenant-scoped (NOT_FOUND out of scope). */
async function loadChange(ctx: AuthContext, id: string): Promise<{ co: ChangeOrder; accountOwnerUserId: string | null }> {
  const db = getDb();
  const co = await db.query.changeOrders.findFirst({ where: eq(schema.changeOrders.id, id) });
  if (!co) throw new StageError("NOT_FOUND", "Change order not found.");
  if (!canAccessProject(ctx.accessScope, { id: co.projectId, organizationId: co.organizationId })) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "load_change", resource: `change:${id}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Change order not found.");
  }
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, co.organizationId) });
  return { co, accountOwnerUserId: org?.accountOwnerUserId ?? null };
}

function isOwnerOrAdmin(ctx: AuthContext, accountOwnerUserId: string | null): boolean {
  return ctx.isAdmin || (ctx.user.role === "account_owner" && ctx.user.id === accountOwnerUserId);
}
function isClientApprover(ctx: AuthContext, co: ChangeOrder): boolean {
  return ctx.user.userType === "client" && CLIENT_APPROVER_ROLES.has(ctx.user.role) && ctx.organizationId === co.organizationId;
}

/** The actions allowed right now for this actor (= the buttons the UI should show). */
export function changeActionsFor(ctx: AuthContext, co: ChangeOrder, accountOwnerUserId: string | null): ChangeAction[] {
  const owner = isOwnerOrAdmin(ctx, accountOwnerUserId);
  const client = isClientApprover(ctx, co);
  switch (co.status) {
    case "draft":
      return owner ? ["send_quote", "decline"] : [];
    case "quoted":
      return client ? ["approve", "reject"] : [];
    case "approved":
      if (co.totalAmountCents > 0) return ctx.isAdmin ? ["mark_paid"] : [];
      return owner ? ["apply"] : []; // $0 → no payment, apply directly
    case "paid":
      return owner ? ["apply"] : [];
    default:
      return [];
  }
}

/** Resolve the {from, to, fields} for an action against the current change order. */
function resolveTransition(
  action: ChangeAction,
  co: ChangeOrder,
  extra: { totalAmountCents?: number; stripeRef?: string; taskId?: string },
): { from: StageStatus; to: StageStatus; fields: Partial<typeof schema.changeOrders.$inferInsert> } {
  switch (action) {
    case "send_quote": {
      const total = Math.max(0, Math.round(extra.totalAmountCents ?? 0));
      return {
        from: "draft",
        to: "quoted",
        fields: {
          totalAmountCents: total,
          requiresAdminApproval: requiresAdminApproval(total, adminApprovalThresholdCents()),
          taskId: extra.taskId || null, // attach to the chosen task (renders as a Change subitem there)
        },
      };
    }
    case "approve":
      return { from: "quoted", to: "approved", fields: {} };
    case "reject":
      return { from: "quoted", to: "rejected", fields: {} };
    case "decline":
      return { from: "draft", to: "rejected", fields: {} };
    case "mark_paid":
      if (co.totalAmountCents <= 0) throw new StageError("INVALID_STATE", "This change has no charge to mark paid.");
      return { from: "approved", to: "paid", fields: { paidAt: new Date(), stripeRef: extra.stripeRef ?? co.stripeRef } };
    case "apply": {
      if (co.status === "paid") return { from: "paid", to: "accepted", fields: {} };
      if (co.status === "approved" && co.totalAmountCents === 0) return { from: "approved", to: "accepted", fields: {} };
      throw new StageError("INVALID_STATE", "This change can't be applied yet.");
    }
  }
}

/** Authorize an action for the actor (role + tenant + over-threshold co-sign). */
function assertChangeAuth(ctx: AuthContext, action: ChangeAction, co: ChangeOrder, accountOwnerUserId: string | null): void {
  const deny = (reason: string) => {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: `change.${action}`, resource: `change:${co.id}`, reason });
    throw new StageError("FORBIDDEN", reason);
  };
  if (action === "approve" || action === "reject") {
    if (!isClientApprover(ctx, co)) deny("Only the client can approve or reject a change.");
    return;
  }
  if (action === "mark_paid") {
    if (!ctx.isAdmin) deny("Only a Wahala admin can mark a change paid.");
    return;
  }
  // send_quote / decline / apply — admin or the org's Account Owner.
  if (!isOwnerOrAdmin(ctx, accountOwnerUserId)) deny("Only a Wahala admin or the Account Owner can do this.");
  // Over-threshold change quotes require an admin co-sign.
  if (action === "send_quote") {
    // checked against the quoted amount in applyChangeAction (we don't have extra here)
  }
}

/** Client (or staff) opens a change request → a draft change order. Returns its id. */
export async function requestChange(
  ctx: AuthContext,
  input: { projectId: string; stageId?: string; name: string; description?: string },
): Promise<string> {
  const project = await scopedDb(ctx).getProject(input.projectId);
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "Describe the change in a short title.");

  const db = getDb();
  const id = crypto.randomUUID();
  await db.batch([
    db.insert(schema.changeOrders).values({
      id,
      organizationId: project.organizationId,
      projectId: project.id,
      stageId: input.stageId || null,
      name,
      description: input.description?.trim() || null,
      status: "draft",
      totalAmountCents: 0,
      requiresAdminApproval: false,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: project.organizationId,
        actorUserId: ctx.user.id,
        action: "change_order.requested",
        entityType: "change_order",
        entityId: id,
        metadata: { name, stageId: input.stageId ?? null },
      }),
    ),
  ]);
  return id;
}

/** Apply a lifecycle action to a change order (CAS + audit). */
export async function applyChangeAction(
  ctx: AuthContext,
  id: string,
  action: ChangeAction,
  extra: { totalAmountCents?: number; stripeRef?: string; note?: string; taskId?: string } = {},
): Promise<ChangeOrder> {
  const db = getDb();
  const { co, accountOwnerUserId } = await loadChange(ctx, id);
  assertChangeAuth(ctx, action, co, accountOwnerUserId);

  const { from, to, fields } = resolveTransition(action, co, extra);

  // Over-threshold change quotes need an admin co-sign (mirror stage rule).
  if (action === "send_quote") {
    const total = fields.totalAmountCents ?? 0;
    if (requiresAdminApproval(total, adminApprovalThresholdCents()) && !ctx.isAdmin) {
      securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "change.send_quote", resource: `change:${id}`, reason: "over_threshold_needs_admin" });
      throw new StageError("FORBIDDEN", "Change quotes over the approval threshold require a Wahala admin.");
    }
  }

  const updated = await db
    .update(schema.changeOrders)
    .set({ ...fields, status: to, updatedAt: new Date() })
    .where(and(eq(schema.changeOrders.id, id), eq(schema.changeOrders.status, from)))
    .returning({ id: schema.changeOrders.id });
  if (updated.length === 0) {
    throw new StageError("CONFLICT", "This change was just updated by someone else — reload and try again.");
  }

  // Applying a billable change re-scopes the stage: its fixed price goes up by the change amount.
  if (action === "apply" && co.stageId && co.totalAmountCents > 0) {
    await db
      .update(schema.stages)
      .set({ totalAmountCents: sql`${schema.stages.totalAmountCents} + ${co.totalAmountCents}`, updatedAt: new Date() })
      .where(eq(schema.stages.id, co.stageId));
  }

  await recordChange(db, ctx, {
    organizationId: co.organizationId,
    actorUserId: ctx.user.id,
    action: `change_order.${action}`,
    entityType: "change_order",
    entityId: id,
    metadata: { from, to, totalAmountCents: fields.totalAmountCents ?? co.totalAmountCents, ...(extra.note?.trim() ? { note: extra.note.trim() } : {}) },
  });
  return { ...co, ...fields, status: to } as ChangeOrder;
}

/** Change orders attached to a stage, each with the actions allowed for this actor. */
export async function listChangeOrdersForStage(ctx: AuthContext, stageId: string): Promise<ChangeOrderView[]> {
  const stage = await scopedDb(ctx).getStage(stageId); // tenant + project scope
  if (!stage) return [];
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, stage.organizationId) });
  const accountOwnerUserId = org?.accountOwnerUserId ?? null;

  const rows = await db
    .select()
    .from(schema.changeOrders)
    .where(eq(schema.changeOrders.stageId, stageId))
    .orderBy(schema.changeOrders.createdAt);

  return rows.map((co) => ({
    id: co.id,
    name: co.name,
    description: co.description,
    status: co.status,
    totalAmountCents: co.totalAmountCents,
    requiresAdminApproval: co.requiresAdminApproval,
    taskId: co.taskId ?? null,
    actions: changeActionsFor(ctx, co, accountOwnerUserId),
  }));
}
