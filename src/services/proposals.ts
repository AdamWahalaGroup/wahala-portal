/**
 * Proposals service (R3): the commercial offering between solution design and
 * contract. Always Option A / Option B. Versioned — sending a proposal supersedes
 * any other open version on the same deal. Approval (public share link or recorded
 * manually) is the good-faith agreement to proceed — NO deposit — and moves the
 * deal's disposition to 'contract'.
 *
 * RBAC mirrors sales.ts: admin/account_owner manage; all staff can read (scoped).
 * The public token path is deliberately tiny: read a sent proposal, approve once.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { needsEngineeringReview } from "@/domain/sales";
import { assertSalesManager } from "@/services/sales";
import { draftProposal } from "@/services/ai/proposal";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import type { DraftUsage } from "@/services/ai/provider";

export type ProposalStatus = (typeof schema.PROPOSAL_STATUSES)[number];

export type ProposalOption = {
  id: string;
  label: string;
  name: string;
  summaryMd: string;
  timelineNote: string | null;
  priceCents: number;
  priceNote: string | null;
};

export type ProposalDetail = {
  id: string;
  dealId: string;
  dealName: string;
  organizationId: string;
  organizationName: string;
  version: number;
  status: ProposalStatus;
  title: string;
  executiveSummaryMd: string | null;
  assumptionsMd: string | null;
  complexityScore: number | null;
  complexityRationale: string | null;
  needsReview: boolean;
  shareToken: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  respondedByName: string | null;
  responseNote: string | null;
  selectedOptionId: string | null;
  options: ProposalOption[];
};

export type ProposalSummary = {
  id: string;
  version: number;
  status: ProposalStatus;
  title: string;
  complexityScore: number | null;
  needsReview: boolean;
  sentAt: Date | null;
  respondedAt: Date | null;
  selectedLabel: string | null;
};

function assertStaffScoped(ctx: AuthContext, organizationId: string, action: string): void {
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Wahala staff only.");
  }
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(organizationId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Not found.");
  }
}

async function loadProposal(proposalId: string) {
  const db = getDb();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!p) throw new StageError("NOT_FOUND", "Proposal not found.");
  return p;
}

async function loadOptions(proposalId: string): Promise<ProposalOption[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.proposalOptions)
    .where(eq(schema.proposalOptions.proposalId, proposalId))
    .orderBy(schema.proposalOptions.sortOrder);
  return rows.map((o) => ({
    id: o.id,
    label: o.label,
    name: o.name,
    summaryMd: o.summaryMd,
    timelineNote: o.timelineNote,
    priceCents: o.priceCents,
    priceNote: o.priceNote,
  }));
}

// ---------------------------------------------------------------- read

export async function listProposalsForDeal(ctx: AuthContext, dealId: string): Promise<ProposalSummary[]> {
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  assertStaffScoped(ctx, deal.organizationId, "list_proposals");

  const rows = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.dealId, dealId))
    .orderBy(desc(schema.proposals.version));
  if (rows.length === 0) return [];

  const selectedIds = rows.map((p) => p.selectedOptionId).filter((v): v is string => !!v);
  const selected = selectedIds.length
    ? await db
        .select({ id: schema.proposalOptions.id, label: schema.proposalOptions.label })
        .from(schema.proposalOptions)
        .where(inArray(schema.proposalOptions.id, selectedIds))
    : [];
  const selectedLabel = new Map(selected.map((o) => [o.id, o.label]));

  return rows.map((p) => ({
    id: p.id,
    version: p.version,
    status: p.status,
    title: p.title,
    complexityScore: p.complexityScore,
    needsReview: needsEngineeringReview(p.complexityScore),
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    selectedLabel: p.selectedOptionId ? selectedLabel.get(p.selectedOptionId) ?? null : null,
  }));
}

export async function getProposal(ctx: AuthContext, proposalId: string): Promise<ProposalDetail> {
  const db = getDb();
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "get_proposal");
  const [deal, org, options] = await Promise.all([
    db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) }),
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, p.organizationId) }),
    loadOptions(proposalId),
  ]);
  return {
    id: p.id,
    dealId: p.dealId,
    dealName: deal?.name ?? "Deal",
    organizationId: p.organizationId,
    organizationName: org?.name ?? "Unknown",
    version: p.version,
    status: p.status,
    title: p.title,
    executiveSummaryMd: p.executiveSummaryMd,
    assumptionsMd: p.assumptionsMd,
    complexityScore: p.complexityScore,
    complexityRationale: p.complexityRationale,
    needsReview: needsEngineeringReview(p.complexityScore),
    shareToken: p.shareToken,
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    respondedByName: p.respondedByName,
    responseNote: p.responseNote,
    selectedOptionId: p.selectedOptionId,
    options,
  };
}

// ---------------------------------------------------------------- create (AI)

/** AI-draft a new proposal version for a deal (next version number, status draft). */
export async function generateProposal(
  ctx: AuthContext,
  dealId: string,
): Promise<{ proposalId: string; usage: DraftUsage }> {
  assertSalesManager(ctx, "generate_proposal");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  assertStaffScoped(ctx, deal.organizationId, "generate_proposal");
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) });
  if (!org) throw new StageError("NOT_FOUND", "Deal not found.");

  // Previous version's content grounds the rewrite ("keep what they reacted well to").
  const previous = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.dealId, dealId))
    .orderBy(desc(schema.proposals.version))
    .limit(1);
  const prev = previous[0] ?? null;
  let previousProposalMd: string | null = null;
  if (prev) {
    const prevOptions = await loadOptions(prev.id);
    previousProposalMd = [
      `# ${prev.title} (v${prev.version}, ${prev.status})`,
      prev.executiveSummaryMd ?? "",
      ...prevOptions.map((o) => `## Option ${o.label}: ${o.name}\n${o.summaryMd}`),
    ].join("\n\n");
  }

  const { draft, usage } = await draftProposal(ctx, {
    orgName: org.name,
    dealName: deal.name,
    dealNotes: deal.notes,
    discoveryMd: deal.discoveryMd,
    clientMemoryMd: org.aiContextMd,
    previousProposalMd,
  });

  const proposalId = crypto.randomUUID();
  await db.batch([
    db.insert(schema.proposals).values({
      id: proposalId,
      organizationId: deal.organizationId,
      dealId,
      version: (prev?.version ?? 0) + 1,
      status: "draft",
      title: draft.title,
      executiveSummaryMd: draft.executiveSummaryMd,
      assumptionsMd: draft.assumptionsMd,
      complexityScore: draft.complexityScore,
      complexityRationale: draft.complexityRationale,
      createdByUserId: ctx.user.id,
    }),
    db.insert(schema.proposalOptions).values(
      draft.options.map((o, i) => ({
        proposalId,
        label: o.label,
        name: o.name,
        summaryMd: o.summaryMd,
        timelineNote: o.timelineNote || null,
        sortOrder: i,
      })),
    ),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.drafted",
        entityType: "proposal",
        entityId: proposalId,
        metadata: {
          dealId,
          version: (prev?.version ?? 0) + 1,
          complexityScore: draft.complexityScore,
          model: usage.model,
          costCents: usage.costCents,
        },
      }),
    ),
  ]);

  return { proposalId, usage };
}

// ---------------------------------------------------------------- edit (draft only)

export async function updateProposal(
  ctx: AuthContext,
  proposalId: string,
  input: { title?: string; executiveSummaryMd?: string; assumptionsMd?: string },
): Promise<void> {
  assertSalesManager(ctx, "update_proposal");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "update_proposal");
  if (p.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft proposal can be edited — create a new version.");

  const patch: Partial<typeof schema.proposals.$inferInsert> = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new StageError("VALIDATION", "Title cannot be empty.");
    patch.title = t;
  }
  if (input.executiveSummaryMd !== undefined) patch.executiveSummaryMd = input.executiveSummaryMd.trim() || null;
  if (input.assumptionsMd !== undefined) patch.assumptionsMd = input.assumptionsMd.trim() || null;
  if (Object.keys(patch).length === 0) return;
  await getDb().update(schema.proposals).set(patch).where(eq(schema.proposals.id, proposalId));
}

export async function updateProposalOption(
  ctx: AuthContext,
  proposalId: string,
  optionId: string,
  input: { name?: string; summaryMd?: string; timelineNote?: string; priceCents?: number; priceNote?: string },
): Promise<void> {
  assertSalesManager(ctx, "update_proposal_option");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "update_proposal_option");
  if (p.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft proposal can be edited — create a new version.");

  const db = getDb();
  const patch: Partial<typeof schema.proposalOptions.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new StageError("VALIDATION", "Option name cannot be empty.");
    patch.name = n;
  }
  if (input.summaryMd !== undefined) patch.summaryMd = input.summaryMd;
  if (input.timelineNote !== undefined) patch.timelineNote = input.timelineNote.trim() || null;
  if (input.priceCents !== undefined) patch.priceCents = Math.max(0, Math.round(input.priceCents));
  if (input.priceNote !== undefined) patch.priceNote = input.priceNote.trim() || null;
  if (Object.keys(patch).length === 0) return;
  const [row] = await db
    .update(schema.proposalOptions)
    .set(patch)
    .where(and(eq(schema.proposalOptions.id, optionId), eq(schema.proposalOptions.proposalId, proposalId)))
    .returning({ id: schema.proposalOptions.id });
  if (!row) throw new StageError("NOT_FOUND", "Option not found on this proposal.");
}

// ---------------------------------------------------------------- send / respond

/**
 * Send: both options must be priced; generates the public share token; supersedes
 * every other open (draft/sent) proposal on the deal; nudges the deal's disposition
 * to 'proposal' if it's still earlier in the funnel. Complexity >3 is a SOFT flag —
 * the UI confirms, the server never blocks.
 */
export async function sendProposal(ctx: AuthContext, proposalId: string): Promise<{ shareToken: string }> {
  assertSalesManager(ctx, "send_proposal");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "send_proposal");
  if (p.status !== "draft") throw new StageError("INVALID_STATE", `Cannot send a ${p.status} proposal.`);

  const options = await loadOptions(proposalId);
  if (options.length < 2) throw new StageError("VALIDATION", "A proposal needs both options before it goes out.");
  if (options.some((o) => o.priceCents <= 0)) {
    throw new StageError("VALIDATION", "Price both options before sending — the AI never prices, a human must.");
  }

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) });
  const shareToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const now = new Date();

  const others = await db
    .select({ id: schema.proposals.id })
    .from(schema.proposals)
    .where(and(eq(schema.proposals.dealId, p.dealId), inArray(schema.proposals.status, ["draft", "sent"])));
  const otherIds = others.map((o) => o.id).filter((oid) => oid !== proposalId);

  const statements: BatchItem<"sqlite">[] = [
    db.update(schema.proposals).set({ status: "sent", shareToken, sentAt: now }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.sent",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { version: p.version, complexityScore: p.complexityScore, superseded: otherIds.length },
      }),
    ),
  ];
  if (otherIds.length > 0) {
    statements.push(
      db.update(schema.proposals).set({ status: "superseded" }).where(inArray(schema.proposals.id, otherIds)),
    );
  }
  // Disposition nudge: a sent proposal means the deal IS at the proposal stage.
  if (deal && ["discovery", "business_requirements", "solution_design"].includes(deal.stage)) {
    statements.push(
      db.update(schema.deals).set({ stage: "proposal", stageEnteredAt: now }).where(eq(schema.deals.id, deal.id)),
      db.insert(schema.auditLog).values(
        buildAudit({
          organizationId: p.organizationId,
          actorUserId: ctx.user.id,
          action: "deal.stage_changed",
          entityType: "deal",
          entityId: deal.id,
          metadata: { from: deal.stage, to: "proposal", via: "proposal.sent" },
        }),
      ),
    );
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { shareToken };
}

/** Shared approve/decline bookkeeping used by both the public link and staff recording. */
async function applyResponse(
  p: typeof schema.proposals.$inferSelect,
  input: {
    outcome: "approved" | "declined";
    optionId?: string;
    respondedByName: string;
    responseNote?: string;
    actorUserId: string | null;
  },
): Promise<void> {
  const db = getDb();
  if (p.status !== "sent") throw new StageError("INVALID_STATE", "This proposal is not open for a response.");

  let selectedOptionId: string | null = null;
  if (input.outcome === "approved") {
    if (!input.optionId) throw new StageError("VALIDATION", "Pick Option A or Option B to approve.");
    const options = await loadOptions(p.id);
    if (!options.some((o) => o.id === input.optionId)) {
      throw new StageError("VALIDATION", "That option does not belong to this proposal.");
    }
    selectedOptionId = input.optionId;
  }

  const now = new Date();
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.proposals)
      .set({
        status: input.outcome,
        respondedAt: now,
        respondedByName: input.respondedByName.trim() || null,
        responseNote: input.responseNote?.trim() || null,
        selectedOptionId,
      })
      .where(eq(schema.proposals.id, p.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: input.actorUserId,
        action: input.outcome === "approved" ? "proposal.approved" : "proposal.declined",
        entityType: "proposal",
        entityId: p.id,
        metadata: { version: p.version, respondedByName: input.respondedByName, optionId: selectedOptionId },
      }),
    ),
  ];

  // "You don't move to contract until the proposal's signed." Approval moves the deal.
  if (input.outcome === "approved") {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) });
    if (deal && !["contract", "won", "lost"].includes(deal.stage)) {
      statements.push(
        db.update(schema.deals).set({ stage: "contract", stageEnteredAt: now }).where(eq(schema.deals.id, deal.id)),
        db.insert(schema.auditLog).values(
          buildAudit({
            organizationId: p.organizationId,
            actorUserId: input.actorUserId,
            action: "deal.stage_changed",
            entityType: "deal",
            entityId: deal.id,
            metadata: { from: deal.stage, to: "contract", via: "proposal.approved" },
          }),
        ),
      );
    }
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}

/** Staff records a response received outside the app (call, email, meeting). */
export async function recordProposalResponse(
  ctx: AuthContext,
  proposalId: string,
  input: { outcome: "approved" | "declined"; optionId?: string; respondedByName?: string; responseNote?: string },
): Promise<void> {
  assertSalesManager(ctx, "record_proposal_response");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "record_proposal_response");
  await applyResponse(p, {
    outcome: input.outcome,
    optionId: input.optionId,
    respondedByName: input.respondedByName?.trim() || ctx.user.name,
    responseNote: input.responseNote,
    actorUserId: ctx.user.id,
  });
}

// ---------------------------------------------------------------- public (share link)

export type PublicProposal = {
  organizationName: string;
  version: number;
  status: ProposalStatus;
  title: string;
  executiveSummaryMd: string | null;
  assumptionsMd: string | null;
  sentAt: Date | null;
  respondedByName: string | null;
  selectedOptionId: string | null;
  options: ProposalOption[];
};

/** Read a proposal by its share token — only sent/approved/declined are visible. */
export async function getProposalByToken(token: string): Promise<PublicProposal | null> {
  if (!token || token.length < 32) return null;
  const db = getDb();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.shareToken, token) });
  if (!p || p.status === "draft" || p.status === "superseded") return null;
  const [org, options] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, p.organizationId) }),
    loadOptions(p.id),
  ]);
  return {
    organizationName: org?.name ?? "your team",
    version: p.version,
    status: p.status,
    title: p.title,
    executiveSummaryMd: p.executiveSummaryMd,
    assumptionsMd: p.assumptionsMd,
    sentAt: p.sentAt,
    respondedByName: p.respondedByName,
    selectedOptionId: p.selectedOptionId,
    options,
  };
}

/** The prospect approves via the share link: typed name + chosen option. One shot. */
export async function approveProposalByToken(
  token: string,
  input: { optionId: string; name: string },
): Promise<void> {
  if (!token || token.length < 32) throw new StageError("NOT_FOUND", "Proposal not found.");
  const name = input.name?.trim();
  if (!name || name.length < 2) throw new StageError("VALIDATION", "Type your name to approve.");
  const db = getDb();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.shareToken, token) });
  if (!p) throw new StageError("NOT_FOUND", "Proposal not found.");
  await applyResponse(p, {
    outcome: "approved",
    optionId: input.optionId,
    respondedByName: name,
    actorUserId: null, // the prospect isn't a portal user — the typed name is the record
  });
}
