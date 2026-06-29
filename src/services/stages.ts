/**
 * Stage service — orchestrates the pay-as-you-go lifecycle (PLAN.md §1, §5).
 *
 * Every mutation flows through one path: load (tenant-scoped) → authorize (policy)
 * → assert legal transition + pay-gate (state machine) → write state + audit in a
 * single batch. This is the server-side chokepoint where the invariants hold:
 *   • no delivery before payment   • no cross-tenant action   • everything logged.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessProject } from "@/auth/access";
import { canActOnStage, type PolicyActor, type StageResource } from "@/auth/policy";
import {
  ACTION_TRANSITION,
  assertStageAction,
  requiresAdminApproval,
  StageError,
  type StageAction,
} from "@/domain/stage-machine";
import { buildAudit, type AuditInput } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import { adminApprovalThresholdCents } from "@/auth/server-env";

type Stage = typeof schema.stages.$inferSelect;
type StageUpdate = Partial<typeof schema.stages.$inferInsert>;
type Db = ReturnType<typeof getDb>;

/**
 * Audit a successful transition. Best-effort: the state change is the source of
 * truth; on the rare audit-write failure we log rather than fail the request.
 * (D1 has no interactive transactions, so the CAS update + audit are two steps;
 * the audit only runs after the CAS has already applied.)
 */
async function recordTransition(db: Db, ctx: AuthContext | null, audit: AuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLog).values(buildAudit(audit));
  } catch (err) {
    securityLog({
      actorUserId: ctx?.user.id ?? null,
      role: ctx?.user.role,
      action: `audit_write_failed:${audit.action}`,
      resource: `${audit.entityType}:${audit.entityId}`,
      reason: String(err),
    });
  }
}

function actorFromCtx(ctx: AuthContext): PolicyActor {
  return {
    userId: ctx.user.id,
    userType: ctx.user.userType,
    role: ctx.user.role,
    organizationId: ctx.organizationId,
    isAdmin: ctx.isAdmin,
  };
}

/** Load a stage with the project + org context the policy needs. Tenant-isolated. */
async function loadStageContext(ctx: AuthContext, stageId: string) {
  const db = getDb();
  const stage = await db.query.stages.findFirst({
    where: eq(schema.stages.id, stageId),
    with: { project: true },
  });
  if (!stage) throw new StageError("NOT_FOUND", "Stage not found.");

  // Tenant + project scope: the caller may never even load a stage out of scope.
  if (!canAccessProject(ctx.accessScope, { id: stage.projectId, organizationId: stage.organizationId })) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "load_stage",
      resource: `stage:${stage.id}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Stage not found.");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, stage.organizationId),
  });

  return {
    stage,
    resource: {
      organizationId: stage.organizationId,
      projectLeadUserId: stage.project?.leadEngineerUserId ?? null,
      accountOwnerUserId: org?.accountOwnerUserId ?? null,
    },
  };
}

/** Per-action field updates layered on top of the status change. */
function actionFields(
  action: StageAction,
  ctx: AuthContext,
  stage: Stage,
  extra: { stripeRef?: string },
): StageUpdate {
  const now = new Date();
  switch (action) {
    case "send_quote":
      return {
        requiresAdminApproval: requiresAdminApproval(
          stage.totalAmountCents,
          adminApprovalThresholdCents(),
        ),
      };
    case "approve_quote":
      return { approvedByUserId: ctx.user.id, quoteApprovedAt: now };
    case "mark_paid":
      return { paidAt: now, stripeRef: extra.stripeRef ?? stage.stripeRef };
    case "deliver":
      return { deliveredAt: now };
    case "accept":
      return { acceptedByUserId: ctx.user.id, acceptedAt: now };
    default:
      return {};
  }
}

/**
 * Apply a lifecycle action to a stage as `ctx`. Returns the updated stage.
 * Throws StageError (NOT_FOUND / FORBIDDEN / INVALID_STATE / PAY_GATE).
 */
export async function applyStageAction(
  ctx: AuthContext,
  stageId: string,
  action: StageAction,
  extra: { stripeRef?: string; note?: string } = {},
): Promise<Stage> {
  const db = getDb();
  const { stage, resource } = await loadStageContext(ctx, stageId);

  // Authorize (role + tenant + ownership; over-threshold co-sign for quotes).
  const overThreshold =
    action === "send_quote" &&
    requiresAdminApproval(stage.totalAmountCents, adminApprovalThresholdCents());
  const decision = canActOnStage(actorFromCtx(ctx), action, resource, { overThreshold });
  if (!decision.allowed) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: `stage.${action}`,
      resource: `stage:${stageId}`,
      reason: decision.reason,
    });
    throw new StageError("FORBIDDEN", decision.reason);
  }

  // Assert legal transition + the hard pay-gate.
  const { from, to } = assertStageAction(action, stage.status, stage);

  const fields = actionFields(action, ctx, stage, extra);
  const set: StageUpdate = { ...fields, status: to, updatedAt: new Date() };

  // Compare-and-swap: only transition if the stage is STILL in `from`. A concurrent
  // request that already moved it leaves this UPDATE matching 0 rows → CONFLICT.
  const updated = await db
    .update(schema.stages)
    .set(set)
    .where(and(eq(schema.stages.id, stage.id), eq(schema.stages.status, from)))
    .returning({ id: schema.stages.id });

  if (updated.length === 0) {
    throw new StageError(
      "CONFLICT",
      "This stage was just changed by someone else — reload and try again.",
    );
  }

  await recordTransition(db, ctx, {
    organizationId: stage.organizationId,
    actorUserId: ctx.user.id,
    action: `stage.${action}`,
    entityType: "stage",
    entityId: stage.id,
    metadata: { from, to, totalAmountCents: stage.totalAmountCents, ...(extra.note?.trim() ? { note: extra.note.trim() } : {}) },
  });

  return { ...stage, ...set } as Stage;
}

// Ergonomic wrappers ---------------------------------------------------------

export const sendQuote = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "send_quote");
export const approveQuote = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "approve_quote");
export const rejectQuote = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "reject_quote");
export const startWork = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "start_work");
export const resumeWork = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "resume_work");
export const deliver = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "deliver");
export const acceptStage = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "accept");
export const requestRevision = (ctx: AuthContext, id: string) => applyStageAction(ctx, id, "request_revision");

/** Manual admin mark-paid (test/ops). The Stripe webhook uses the system path below. */
export const markPaid = (ctx: AuthContext, id: string, stripeRef?: string) =>
  applyStageAction(ctx, id, "mark_paid", { stripeRef });

/**
 * System (no user) payment confirmation — the seam the Stripe webhook will call.
 * Bypasses user RBAC (the webhook signature is the authority) but still enforces
 * the state machine and writes an audit row with a null actor.
 */
export async function markStagePaidBySystem(stageId: string, stripeRef: string): Promise<Stage> {
  const db = getDb();
  const stage = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
  if (!stage) throw new StageError("NOT_FOUND", "Stage not found.");

  // Idempotent: a webhook retry on an already-paid (or not-yet-approved) stage is a no-op.
  if (stage.status !== "approved") return stage;

  const set: StageUpdate = {
    status: "paid",
    paidAt: new Date(),
    stripeRef,
    updatedAt: new Date(),
  };

  // Compare-and-swap on `approved` — also the idempotency guard for webhook retries.
  const updated = await db
    .update(schema.stages)
    .set(set)
    .where(and(eq(schema.stages.id, stageId), eq(schema.stages.status, "approved")))
    .returning({ id: schema.stages.id });

  if (updated.length === 0) {
    // Lost the race / already paid — return current state (idempotent, not an error).
    const fresh = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
    return fresh ?? stage;
  }

  await recordTransition(db, null, {
    organizationId: stage.organizationId,
    actorUserId: null,
    action: "stage.mark_paid",
    entityType: "stage",
    entityId: stageId,
    metadata: { from: "approved", to: "paid", stripeRef, via: "stripe_webhook" },
  });
  return { ...stage, ...set } as Stage;
}

/**
 * Actions that are BOTH state-legal from the stage's current status AND permitted
 * for this actor — i.e. exactly the buttons the UI should render.
 */
export function availableActions(
  ctx: AuthContext,
  stage: Stage,
  resource: StageResource,
): StageAction[] {
  const actor = actorFromCtx(ctx);
  return (Object.keys(ACTION_TRANSITION) as StageAction[])
    .filter((a) => ACTION_TRANSITION[a].from === stage.status)
    .filter((a) => {
      const overThreshold =
        a === "send_quote" &&
        requiresAdminApproval(stage.totalAmountCents, adminApprovalThresholdCents());
      return canActOnStage(actor, a, resource, { overThreshold }).allowed;
    });
}

export type StageDetail = {
  stage: Stage;
  resource: StageResource;
  organizationName: string;
  people: { accountOwner: string | null; leadEngineer: string | null };
  lineItems: (typeof schema.stageLineItems.$inferSelect)[];
  audit: { action: string; createdAt: Date; actorName: string; from?: string; to?: string }[];
  actions: StageAction[];
};

/** Everything the stage detail page needs, in one tenant-isolated read. */
export async function getStageDetail(ctx: AuthContext, stageId: string): Promise<StageDetail> {
  const { stage, resource } = await loadStageContext(ctx, stageId);
  const db = getDb();

  const lineItems = await db
    .select()
    .from(schema.stageLineItems)
    .where(eq(schema.stageLineItems.stageId, stageId))
    .orderBy(schema.stageLineItems.sortOrder);

  const auditRows = await db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.entityType, "stage"), eq(schema.auditLog.entityId, stageId)))
    .orderBy(schema.auditLog.createdAt);

  const actorIds = [...new Set(auditRows.map((r) => r.actorUserId).filter(Boolean))] as string[];
  // Only the columns we render — never pull whole user rows (email/role) here.
  const actors = actorIds.length
    ? await db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(inArray(schema.users.id, actorIds))
    : [];
  const nameById = new Map(actors.map((u) => [u.id, u.name]));

  const audit = auditRows.map((r) => {
    const meta = (r.metadata ?? {}) as { from?: string; to?: string };
    return {
      action: r.action,
      createdAt: r.createdAt,
      actorName: r.actorUserId ? (nameById.get(r.actorUserId) ?? "Unknown") : "System",
      from: meta.from,
      to: meta.to,
    };
  });

  const peopleIds = [resource.accountOwnerUserId, resource.projectLeadUserId].filter(Boolean) as string[];
  const peopleRows = peopleIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, peopleIds))
    : [];
  const pName = new Map(peopleRows.map((u) => [u.id, u.name]));
  const orgRow = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, stage.organizationId),
  });

  return {
    stage,
    resource,
    organizationName: orgRow?.name ?? "—",
    people: {
      accountOwner: resource.accountOwnerUserId ? pName.get(resource.accountOwnerUserId) ?? null : null,
      leadEngineer: resource.projectLeadUserId ? pName.get(resource.projectLeadUserId) ?? null : null,
    },
    lineItems,
    audit,
    actions: availableActions(ctx, stage, resource),
  };
}

/** Create a draft stage with itemized line items. Owner/admin only. */
export async function createStage(
  ctx: AuthContext,
  input: {
    projectId: string;
    name: string;
    scopeDescription?: string;
    totalAmountCents: number;
    lineItems?: { description: string; estimateNote?: string; amountCents?: number }[];
  },
): Promise<Stage> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, input.projectId),
  });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  if (!canAccessProject(ctx.accessScope, { id: project.id, organizationId: project.organizationId })) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "create_stage",
      resource: `project:${project.id}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Project not found.");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, project.organizationId),
  });

  // Authorize: Wahala admin, or the org's Account Owner.
  const isOwner = ctx.user.id === org?.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "create_stage",
      resource: `project:${project.id}`,
      reason: "not_admin_or_owner",
    });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or the Account Owner can create a stage.");
  }

  const stageId = crypto.randomUUID();
  const requiresApproval = requiresAdminApproval(
    input.totalAmountCents,
    adminApprovalThresholdCents(),
  );

  // Built dynamically (variable line-item count), so type loosely and cast at the call.
  const stmts: unknown[] = [
    db.insert(schema.stages).values({
      id: stageId,
      organizationId: project.organizationId,
      projectId: project.id,
      name: input.name,
      scopeDescription: input.scopeDescription ?? null,
      status: "draft",
      totalAmountCents: input.totalAmountCents,
      requiresAdminApproval: requiresApproval,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: project.organizationId,
        actorUserId: ctx.user.id,
        action: "stage.created",
        entityType: "stage",
        entityId: stageId,
        metadata: { totalAmountCents: input.totalAmountCents, requiresApproval },
      }),
    ),
  ];

  (input.lineItems ?? []).forEach((li, i) => {
    stmts.push(
      db.insert(schema.stageLineItems).values({
        stageId,
        description: li.description,
        estimateNote: li.estimateNote ?? null,
        amountCents: li.amountCents ?? 0,
        sortOrder: i,
      }),
    );
  });

  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

  const created = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
  return created!;
}

/** Quote authoring is restricted to a Wahala admin or the org's Account Owner. */
function assertCanQuote(ctx: AuthContext, resource: StageResource, action: string): void {
  const isOwner = ctx.user.id === resource.accountOwnerUserId;
  if (ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner)) return;
  securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_admin_or_owner" });
  throw new StageError("FORBIDDEN", "Only a Wahala admin or the Account Owner can edit this quote.");
}

/**
 * Save the itemized quote on a DRAFT stage (the frame-06 builder). Replaces the
 * stage's line items wholesale (the editor sends the full set each save) and
 * recomputes the stage total = sum of line-item amounts, plus the over-threshold
 * admin-co-sign flag. Draft-only; admin or Account Owner. Does NOT send the quote.
 */
export async function saveQuoteDraft(
  ctx: AuthContext,
  stageId: string,
  input: {
    name: string;
    scopeDescription?: string;
    lineItems: { description: string; estimateNote?: string; amountCents: number }[];
  },
): Promise<Stage> {
  const db = getDb();
  const { stage, resource } = await loadStageContext(ctx, stageId);
  if (stage.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft quote can be edited.");
  assertCanQuote(ctx, resource, "save_quote");

  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "A stage name is required.");

  const items = (input.lineItems ?? [])
    .map((li, i) => ({
      description: li.description?.trim() ?? "",
      estimateNote: li.estimateNote?.trim() || null,
      amountCents: Math.max(0, Math.round(Number(li.amountCents) || 0)),
      sortOrder: i,
    }))
    .filter((li) => li.description.length > 0);

  const totalAmountCents = items.reduce((sum, li) => sum + li.amountCents, 0);
  const requiresApproval = requiresAdminApproval(totalAmountCents, adminApprovalThresholdCents());

  // Replace line items + update the stage atomically. CAS on `draft` so a concurrent
  // send/transition can't be clobbered by a stale save.
  const stmts: unknown[] = [
    db.delete(schema.stageLineItems).where(eq(schema.stageLineItems.stageId, stageId)),
    db
      .update(schema.stages)
      .set({
        name,
        scopeDescription: input.scopeDescription?.trim() || null,
        totalAmountCents,
        requiresAdminApproval: requiresApproval,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.stages.id, stageId), eq(schema.stages.status, "draft"))),
  ];
  items.forEach((li) => {
    stmts.push(db.insert(schema.stageLineItems).values({ stageId, ...li }));
  });
  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

  const updated = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
  return updated!;
}

/**
 * Record that the Account Owner has asked a Wahala admin to co-sign an over-threshold
 * quote (they can't send it themselves). It's a logged request — it shows in the
 * stage History, where any admin opening the stage can review and send.
 */
export async function requestQuoteCosign(ctx: AuthContext, stageId: string): Promise<void> {
  const db = getDb();
  const { stage, resource } = await loadStageContext(ctx, stageId);
  if (stage.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft quote needs co-sign.");
  assertCanQuote(ctx, resource, "request_cosign");
  await recordTransition(db, ctx, {
    organizationId: stage.organizationId,
    actorUserId: ctx.user.id,
    action: "stage.cosign_requested",
    entityType: "stage",
    entityId: stageId,
    metadata: { totalAmountCents: stage.totalAmountCents },
  });
}
