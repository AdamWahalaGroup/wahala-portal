/**
 * Stage service — orchestrates the pay-as-you-go lifecycle (PLAN.md §1, §5).
 *
 * Every mutation flows through one path: load (tenant-scoped) → authorize (policy)
 * → assert legal transition + pay-gate (state machine) → write state + audit in a
 * single batch. This is the server-side chokepoint where the invariants hold:
 *   • no delivery before payment   • no cross-tenant action   • everything logged.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canActOnStage, type PolicyActor } from "@/auth/policy";
import {
  assertStageAction,
  requiresAdminApproval,
  StageError,
  type StageAction,
} from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { adminApprovalThresholdCents } from "@/auth/server-env";

type Stage = typeof schema.stages.$inferSelect;
type StageUpdate = Partial<typeof schema.stages.$inferInsert>;

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

  // Defense in depth: a client may never even load another org's stage.
  if (!ctx.canSeeAllOrgs && stage.organizationId !== ctx.organizationId) {
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
  extra: { stripeRef?: string } = {},
): Promise<Stage> {
  const db = getDb();
  const { stage, resource } = await loadStageContext(ctx, stageId);

  // Authorize (role + tenant + ownership; over-threshold co-sign for quotes).
  const overThreshold =
    action === "send_quote" &&
    requiresAdminApproval(stage.totalAmountCents, adminApprovalThresholdCents());
  const decision = canActOnStage(actorFromCtx(ctx), action, resource, { overThreshold });
  if (!decision.allowed) throw new StageError("FORBIDDEN", decision.reason);

  // Assert legal transition + the hard pay-gate.
  const { from, to } = assertStageAction(action, stage.status, stage);

  const fields = actionFields(action, ctx, stage, extra);
  const set: StageUpdate = { ...fields, status: to, updatedAt: new Date() };

  await db.batch([
    db.update(schema.stages).set(set).where(eq(schema.stages.id, stage.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: stage.organizationId,
        actorUserId: ctx.user.id,
        action: `stage.${action}`,
        entityType: "stage",
        entityId: stage.id,
        metadata: { from, to, totalAmountCents: stage.totalAmountCents },
      }),
    ),
  ]);

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

  const { from, to } = assertStageAction("mark_paid", stage.status, stage);
  const set: StageUpdate = {
    status: to,
    paidAt: new Date(),
    stripeRef,
    updatedAt: new Date(),
  };

  await db.batch([
    db.update(schema.stages).set(set).where(eq(schema.stages.id, stage.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: stage.organizationId,
        actorUserId: null,
        action: "stage.mark_paid",
        entityType: "stage",
        entityId: stage.id,
        metadata: { from, to, stripeRef, via: "stripe_webhook" },
      }),
    ),
  ]);

  return { ...stage, ...set } as Stage;
}

/** Create a draft stage with itemized line items. Owner/admin only. */
export async function createStage(
  ctx: AuthContext,
  input: {
    projectId: string;
    name: string;
    scopeDescription?: string;
    totalAmountCents: number;
    lineItems?: { description: string; estimateNote?: string }[];
  },
): Promise<Stage> {
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, input.projectId),
  });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  if (!ctx.canSeeAllOrgs && project.organizationId !== ctx.organizationId) {
    throw new StageError("NOT_FOUND", "Project not found.");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, project.organizationId),
  });

  // Authorize: Wahala admin, or the org's Account Owner.
  const isOwner = ctx.user.id === org?.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
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
        sortOrder: i,
      }),
    );
  });

  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

  const created = await db.query.stages.findFirst({ where: eq(schema.stages.id, stageId) });
  return created!;
}
