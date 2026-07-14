/**
 * Process service (TRAINING-AND-SCORECARD.md, frames 38–41) — the ONE process
 * model, rendered three ways:
 *   forward  → guidance (training mode: goal rail, package card, next best action)
 *   at send   → evidence coaching (solution clarity + buying path; overrides logged, never blocked)
 *   backward → measurement (frame 40 post-mortem, frame 41 scorecard)
 *
 * Everything measurable comes from the append-only process_events table — no
 * gut-feel fields. Readiness recomputes from Discovery Package completeness only
 * after reviewed evidence or a manual edit is accepted; history keeps per-event
 * snapshots, never mutated.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager, assertStaff } from "@/services/sales";
import { daysInStage, STAGE_META, type DealStage } from "@/domain/sales";
import {
  applyManualField,
  readinessFrom,
  readinessTone,
  failedChecks,
  goalFor,
  nextBestActions,
  journeyIndex,
  JOURNEY,
  SOLUTION_CLARITY_FIELDS,
  PROPOSAL_READY_AT,
  proposalReadinessFrom,
  FOLLOWUP_EXPECTED_DAYS,
  PACKAGE_FIELD_LABELS,
  type PackageField,
  type PackageFieldKey,
  type PackageFields,
  type PackageFieldStatus,
  type NextAction,
  type BuyingPath,
  type BuyingPathFieldKey,
  buyingPathFrom,
  BUYING_PATH_FIELDS,
} from "@/domain/process";
import {
  COMMERCIAL_REVIEW_FIELDS,
  DISCOVERY_REVIEW_ENUMS,
  QUALIFICATION_REVIEW_FIELDS,
  mergeReviewedPackage,
  normalizeDiscoveryAnalysis,
  recommendedDiscoverySelection,
  sanitizeDiscoverySelection,
  type DiscoveryAnalysis,
  type DiscoveryReviewRecommendation,
  type DiscoveryReviewSelection,
} from "@/domain/discovery-review";
import {
  isBudgetStatus,
  isDataSensitivity,
  isDeliveryModel,
  isEngagementType,
  isIpDisposition,
  isNextActionCourt,
  actionUrgencyScore,
} from "@/domain/deal-operating-model";
import { getDraftProvider, type DraftUsage } from "@/services/ai/provider";
import { resolveAgentConfig } from "@/services/ai/agent-config";
import { recordAiRun } from "@/services/ai/usage";
import { buildAudit } from "@/services/audit";

type ProcessEventKind = (typeof schema.PROCESS_EVENT_KINDS)[number];

// ---------------------------------------------------------------- event log (append-only)

/** Low-level append — call from services after their own auth checks. */
export async function recordProcessEvent(input: {
  organizationId: string | null; // null on account-less opportunities
  dealId: string;
  ownerUserId: string | null;
  actorUserId: string | null;
  kind: ProcessEventKind;
  fromStep?: string;
  toStep?: string;
  readinessScore?: number | null;
  metadata?: unknown;
}): Promise<void> {
  await getDb().insert(schema.processEvents).values({
    organizationId: input.organizationId,
    dealId: input.dealId,
    ownerUserId: input.ownerUserId,
    actorUserId: input.actorUserId,
    kind: input.kind,
    fromStep: input.fromStep ?? null,
    toStep: input.toStep ?? null,
    readinessScore: input.readinessScore ?? null,
    metadata: input.metadata ?? null,
  });
}

// ---------------------------------------------------------------- package + solution clarity

async function loadPackage(dealId: string): Promise<PackageFields> {
  const row = await getDb().query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, dealId) });
  return ((row?.fields ?? {}) as PackageFields) || {};
}

export type DealProcess = {
  trainingMode: boolean;
  readiness: number | null;
  tone: "green" | "amber" | "red";
  fields: PackageFields;
  journey: { key: string; label: string }[];
  journeyIndex: number;
  goal: string;
  nextActions: NextAction[];
  buyingPath: BuyingPath;
  calls: {
    id: string;
    title: string;
    recordedAt: Date;
    durationMin: number | null;
    fieldsExtracted: number;
    reviewStatus: "pending" | "applied" | "dismissed";
  }[];
};

/** Everything frame 38 renders on the deal view. */
export async function getDealProcess(ctx: AuthContext, dealId: string): Promise<DealProcess> {
  assertStaff(ctx, "deal_process");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const [fields, calls, me, proposals] = await Promise.all([
    loadPackage(dealId),
    db.select().from(schema.dealCalls).where(eq(schema.dealCalls.dealId, dealId)).orderBy(desc(schema.dealCalls.recordedAt)),
    db.query.users.findFirst({ where: eq(schema.users.id, ctx.user.id) }),
    db.select({ status: schema.proposals.status, complexityScore: schema.proposals.complexityScore }).from(schema.proposals).where(eq(schema.proposals.dealId, dealId)),
  ]);
  const readiness = readinessFrom(fields);
  const buyingPath = buyingPathFrom(deal, fields.buyingPath);
  const open = proposals.filter((p) => p.status !== "superseded" && p.status !== "declined");
  const proposalStatus = open.some((p) => p.status === "approved")
    ? ("approved" as const)
    : open.some((p) => p.status === "sent")
      ? ("sent" as const)
      : open.length > 0
        ? ("draft" as const)
        : ("none" as const);

  return {
    trainingMode: !!me?.trainingMode,
    readiness,
    tone: readinessTone(readiness ?? 0),
    fields,
    journey: JOURNEY,
    journeyIndex: journeyIndex(deal.stage),
    goal: goalFor(deal.stage, readiness, daysInStage(deal.stageEnteredAt, new Date()), buyingPath.status),
    buyingPath,
    nextActions: nextBestActions({
      stage: deal.stage,
      readiness,
      hasDiscoveryMd: !!deal.discoveryMd,
      proposalStatus,
      complexityScore: open[0]?.complexityScore ?? null,
      depositPaid: !!deal.depositPaidAt,
      buyingPathStatus: buyingPath.status,
    }),
    calls: calls.map((c) => ({
      id: c.id,
      title: c.title,
      recordedAt: c.recordedAt,
      durationMin: c.durationMin,
      fieldsExtracted: c.fieldsExtracted,
      reviewStatus: c.reviewStatus,
    })),
  };
}

// ---------------------------------------------------------------- call ingestion (AI extraction)

const evidenceSuggestionSchema = (values?: readonly string[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["suggested", "value", "evidence", "source"],
  properties: {
    suggested: { type: "boolean" },
    value: values ? { type: "string", enum: [...values] } : { type: "string" },
    evidence: { type: "string" },
    source: { type: "string" },
  },
});

const discoveryAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["discoveryMd", "packageFields", "fieldsImproved", "qualification", "commercial", "followUp"],
  properties: {
    discoveryMd: { type: "string" },
    packageFields: {
      type: "object",
      additionalProperties: false,
      required: [...SOLUTION_CLARITY_FIELDS],
      properties: Object.fromEntries(
        SOLUTION_CLARITY_FIELDS.map((k) => [
          k,
          {
            type: "object",
            additionalProperties: false,
            required: ["status", "evidence", "source"],
            properties: {
              status: { type: "string", enum: ["ok", "partial", "missing"] },
              evidence: { type: "string" },
              source: { type: "string" },
            },
          },
        ]),
      ),
    },
    fieldsImproved: { type: "integer" },
    qualification: {
      type: "object",
      additionalProperties: false,
      required: [...QUALIFICATION_REVIEW_FIELDS],
      properties: {
        champion: evidenceSuggestionSchema(),
        economicBuyer: evidenceSuggestionSchema(),
        compellingEvent: evidenceSuggestionSchema(),
        decisionProcess: evidenceSuggestionSchema(),
        budgetStatus: evidenceSuggestionSchema(DISCOVERY_REVIEW_ENUMS.budgetStatus),
        budgetEvidence: evidenceSuggestionSchema(),
      },
    },
    commercial: {
      type: "object",
      additionalProperties: false,
      required: [...COMMERCIAL_REVIEW_FIELDS],
      properties: {
        engagementType: evidenceSuggestionSchema(DISCOVERY_REVIEW_ENUMS.engagementType),
        deliveryModel: evidenceSuggestionSchema(DISCOVERY_REVIEW_ENUMS.deliveryModel),
        ipDisposition: evidenceSuggestionSchema(DISCOVERY_REVIEW_ENUMS.ipDisposition),
        dataSensitivity: evidenceSuggestionSchema(DISCOVERY_REVIEW_ENUMS.dataSensitivity),
        supportExpectation: evidenceSuggestionSchema(),
      },
    },
    followUp: {
      type: "object",
      additionalProperties: false,
      required: ["suggested", "action", "dueAt", "court", "evidence", "source"],
      properties: {
        suggested: { type: "boolean" },
        action: { type: "string" },
        dueAt: { type: "string" },
        court: { type: "string", enum: [...DISCOVERY_REVIEW_ENUMS.nextActionCourt] },
        evidence: { type: "string" },
        source: { type: "string" },
      },
    },
  },
} as const;

/**
 * The shared ingest core — the authed paste path AND the Zoom webhook (no user
 * context, actorUserId null) both land here. The source and analysis are durable,
 * but the Deal remains unchanged until a human reviews and applies selections.
 */
export async function ingestCallCore(
  deal: typeof schema.deals.$inferSelect,
  input: { title: string; transcriptMd: string; recordedAt?: string | Date; durationMin?: number | null },
  actorUserId: string | null,
  trigger: "user" | "webhook" = "user",
): Promise<{
  callId: string;
  analysis: DiscoveryAnalysis;
  recommended: DiscoveryReviewRecommendation;
  usage: DraftUsage;
}> {
  const title = input.title?.trim();
  const transcript = input.transcriptMd?.trim();
  if (!title) throw new StageError("VALIDATION", "Give the call a title.");
  if (!transcript) throw new StageError("VALIDATION", "Paste the transcript.");
  const db = getDb();
  const dealId = deal.id;

  const previous = await loadPackage(dealId);
  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("package_extractor");
  const currentDealState = {
    name: deal.name,
    stage: deal.stage,
    discoveryMd: deal.discoveryMd,
    qualification: {
      champion: deal.champion,
      economicBuyer: deal.economicBuyer,
      compellingEvent: deal.compellingEvent,
      decisionProcess: deal.decisionProcess,
      budgetStatus: deal.budgetStatus,
      budgetEvidence: deal.budgetEvidence,
    },
    commercial: {
      engagementType: deal.engagementType,
      deliveryModel: deal.deliveryModel,
      ipDisposition: deal.ipDisposition,
      dataSensitivity: deal.dataSensitivity,
      supportExpectation: deal.supportExpectation,
    },
  };
  const { output, usage } = await provider.completeStructured<DiscoveryAnalysis>({
    system: cfg.systemPrompt,
    parts: [
      { kind: "text", text: `CURRENT PACKAGE (JSON):\n${JSON.stringify(previous)}` },
      { kind: "text", text: `CURRENT DEAL STATE (JSON):\n${JSON.stringify(currentDealState)}` },
      { kind: "text", text: `UNTRUSTED SOURCE MATERIAL\nTITLE: ${title}\n\n${transcript.slice(0, 120_000)}` },
    ],
    schemaName: "discovery_evidence_review",
    schema: discoveryAnalysisSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });
  const analysis = normalizeDiscoveryAnalysis({
    ...output,
    discoveryMd: output.discoveryMd.trim(),
    fieldsImproved: Math.max(0, Math.min(SOLUTION_CLARITY_FIELDS.length, Math.round(output.fieldsImproved))),
  });
  const recommended = recommendedDiscoverySelection(deal, previous, analysis);
  const callId = crypto.randomUUID();

  await db.batch([
    db.insert(schema.dealCalls).values({
      id: callId,
      dealId,
      title,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      durationMin: input.durationMin ?? null,
      transcriptMd: transcript,
      fieldsExtracted: 0,
      discoveryAnalysis: analysis,
      reviewStatus: "pending",
      createdByUserId: actorUserId,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId,
        action: "deal.discovery_analyzed",
        entityType: "deal_call",
        entityId: callId,
        metadata: { dealId, model: usage.model, costCents: usage.costCents, reviewStatus: "pending" },
      }),
    ),
  ]);
  await recordAiRun(db, { agentKey: "package_extractor", trigger, dealId, organizationId: deal.organizationId, ...usage });

  return { callId, analysis, recommended, usage };
}

/**
 * Ingest a recorded call from the UI (paste path). Sales manager (costs money).
 */
export async function ingestCall(
  ctx: AuthContext,
  dealId: string,
  input: { title: string; transcriptMd: string; recordedAt?: string; durationMin?: number },
): Promise<{ callId: string; analysis: DiscoveryAnalysis; recommended: DiscoveryReviewRecommendation; usage: DraftUsage }> {
  assertSalesManager(ctx, "ingest_call");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");
  return ingestCallCore(deal, input, ctx.user.id);
}

export type DiscoveryReviewView = {
  callId: string;
  title: string;
  analysis: DiscoveryAnalysis;
  recommended: DiscoveryReviewRecommendation;
};

async function reviewContext(ctx: AuthContext, dealId: string, callId: string) {
  const db = getDb();
  const [deal, call] = await Promise.all([
    db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) }),
    db.query.dealCalls.findFirst({ where: eq(schema.dealCalls.id, callId) }),
  ]);
  if (!deal || !call || call.dealId !== dealId) throw new StageError("NOT_FOUND", "Discovery review not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId)) {
    throw new StageError("NOT_FOUND", "Discovery review not found.");
  }
  return { db, deal, call };
}

export async function getCallReview(ctx: AuthContext, dealId: string, callId: string): Promise<DiscoveryReviewView | null> {
  assertStaff(ctx, "read_discovery_review");
  const { deal, call } = await reviewContext(ctx, dealId, callId);
  const storedAnalysis = call.discoveryAnalysis as DiscoveryAnalysis | null;
  if (!storedAnalysis) return null;
  const analysis = normalizeDiscoveryAnalysis(storedAnalysis);
  const currentPackage = await loadPackage(dealId);
  return {
    callId,
    title: call.title,
    analysis,
    recommended: recommendedDiscoverySelection(deal, currentPackage, analysis),
  };
}

function acceptedSuggestion<T extends string>(suggestion: { suggested: boolean; value: T }, label: string): T {
  if (!suggestion.suggested || !suggestion.value.trim()) {
    throw new StageError("VALIDATION", `${label} has no supported AI suggestion to apply.`);
  }
  return suggestion.value;
}

export async function applyCallReview(
  ctx: AuthContext,
  dealId: string,
  callId: string,
  requested: DiscoveryReviewSelection,
): Promise<{ readiness: number | null; fieldsImproved: number }> {
  assertSalesManager(ctx, "apply_discovery_review");
  const { db, deal, call } = await reviewContext(ctx, dealId, callId);
  if (call.reviewStatus !== "pending") throw new StageError("INVALID_STATE", "This discovery review is already resolved.");
  const storedAnalysis = call.discoveryAnalysis as DiscoveryAnalysis | null;
  if (!storedAnalysis) throw new StageError("INVALID_STATE", "This call has no reviewable analysis.");
  const analysis = normalizeDiscoveryAnalysis(storedAnalysis);
  const selection = sanitizeDiscoverySelection(requested);
  if (
    !selection.applyDiscoveryMd &&
    selection.packageFields.length === 0 &&
    selection.qualificationFields.length === 0 &&
    selection.commercialFields.length === 0 &&
    !selection.applyFollowUp
  ) {
    throw new StageError("VALIDATION", "Select at least one evidence update, or dismiss the review.");
  }

  const currentPackage = await loadPackage(dealId);
  const packageResult = mergeReviewedPackage(currentPackage, analysis.packageFields, selection.packageFields);
  const dealPatch: Partial<typeof schema.deals.$inferInsert> = {};
  if (selection.applyDiscoveryMd) {
    const memo = analysis.discoveryMd.trim();
    if (!memo) throw new StageError("VALIDATION", "The analysis has no discovery memo to apply.");
    dealPatch.discoveryMd = memo;
  }
  if (selection.packageFields.length > 0) dealPatch.readinessScore = packageResult.readiness;

  for (const key of selection.qualificationFields) {
    const suggestion = analysis.qualification[key];
    const value = acceptedSuggestion(suggestion, key);
    switch (key) {
      case "champion": dealPatch.champion = value; break;
      case "economicBuyer": dealPatch.economicBuyer = value; break;
      case "compellingEvent": dealPatch.compellingEvent = value; break;
      case "decisionProcess": dealPatch.decisionProcess = value; break;
      case "budgetEvidence": dealPatch.budgetEvidence = value; break;
      case "budgetStatus":
        if (!isBudgetStatus(value)) throw new StageError("VALIDATION", "Invalid suggested budget status.");
        dealPatch.budgetStatus = value;
        break;
    }
  }
  const buyingPathUpdates: Partial<Record<BuyingPathFieldKey, PackageField>> = {};
  for (const key of selection.qualificationFields) {
    if (key === "champion" || key === "economicBuyer" || key === "compellingEvent" || key === "decisionProcess") {
      const suggestion = analysis.qualification[key];
      buyingPathUpdates[key] = { status: "ok", evidence: suggestion.value, source: suggestion.source };
    }
  }
  if (selection.qualificationFields.includes("budgetStatus") || selection.qualificationFields.includes("budgetEvidence")) {
    const budgetStatus = dealPatch.budgetStatus ?? deal.budgetStatus;
    const budgetEvidence = dealPatch.budgetEvidence ?? deal.budgetEvidence;
    const supported = (budgetStatus === "funding_path" || budgetStatus === "confirmed") && !!budgetEvidence?.trim();
    const source = selection.qualificationFields.includes("budgetEvidence")
      ? analysis.qualification.budgetEvidence.source
      : analysis.qualification.budgetStatus.source;
    buyingPathUpdates.budget = { status: supported ? "ok" : "partial", evidence: budgetEvidence, source };
  }
  const buyingPathChanged = Object.keys(buyingPathUpdates).length > 0;
  if (buyingPathChanged) {
    packageResult.fields.buyingPath = { ...currentPackage.buyingPath, ...buyingPathUpdates };
  }
  for (const key of selection.commercialFields) {
    const suggestion = analysis.commercial[key];
    const value = acceptedSuggestion(suggestion, key);
    switch (key) {
      case "engagementType":
        if (!isEngagementType(value)) throw new StageError("VALIDATION", "Invalid suggested engagement type.");
        dealPatch.engagementType = value;
        break;
      case "deliveryModel":
        if (!isDeliveryModel(value)) throw new StageError("VALIDATION", "Invalid suggested delivery model.");
        dealPatch.deliveryModel = value;
        break;
      case "ipDisposition":
        if (!isIpDisposition(value)) throw new StageError("VALIDATION", "Invalid suggested IP disposition.");
        dealPatch.ipDisposition = value;
        break;
      case "dataSensitivity":
        if (!isDataSensitivity(value)) throw new StageError("VALIDATION", "Invalid suggested data sensitivity.");
        dealPatch.dataSensitivity = value;
        break;
      case "supportExpectation": dealPatch.supportExpectation = value; break;
    }
  }
  if (selection.applyFollowUp) {
    const suggestion = analysis.followUp;
    const action = suggestion.action.trim();
    const dueAt = suggestion.dueAt.trim();
    if (!suggestion.suggested || !action || !dueAt || !suggestion.evidence.trim()) {
      throw new StageError("VALIDATION", "The analysis has no explicit, evidence-backed follow-up to apply.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt)) {
      throw new StageError("VALIDATION", "The suggested follow-up does not have an exact calendar date.");
    }
    const parsedDueAt = new Date(`${dueAt}T00:00:00.000Z`);
    if (Number.isNaN(parsedDueAt.getTime()) || parsedDueAt.toISOString().slice(0, 10) !== dueAt) {
      throw new StageError("VALIDATION", "The suggested follow-up date is invalid.");
    }
    if (!isNextActionCourt(suggestion.court)) {
      throw new StageError("VALIDATION", "The suggested follow-up has no valid responsible party.");
    }
    dealPatch.nextAction = action;
    dealPatch.nextActionDueAt = parsedDueAt;
    dealPatch.nextActionCourt = suggestion.court;
    dealPatch.actionUrgencyScore = actionUrgencyScore({ nextAction: action, nextActionDueAt: parsedDueAt, now: new Date() });
  }

  const acceptedEvidence = {
    qualification: Object.fromEntries(selection.qualificationFields.map((key) => [key, analysis.qualification[key]])),
    commercial: Object.fromEntries(selection.commercialFields.map((key) => [key, analysis.commercial[key]])),
    followUp: selection.applyFollowUp ? analysis.followUp : null,
  };
  const statements: unknown[] = [
    db.update(schema.deals).set(dealPatch).where(eq(schema.deals.id, dealId)),
    db.update(schema.dealCalls)
      .set({
        reviewStatus: "applied",
        reviewedByUserId: ctx.user.id,
        reviewedAt: new Date(),
        fieldsExtracted: packageResult.fieldsImproved,
      })
      .where(and(eq(schema.dealCalls.id, callId), eq(schema.dealCalls.reviewStatus, "pending"))),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "deal.discovery_review_applied",
        entityType: "deal_call",
        entityId: callId,
        metadata: { selection, acceptedEvidence, solutionClarity: packageResult.readiness },
      }),
    ),
  ];
  if (selection.packageFields.length > 0 || buyingPathChanged) {
    const existing = await db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, dealId) });
    statements.splice(
      1,
      0,
      existing
        ? db.update(schema.discoveryPackages).set({ fields: packageResult.fields }).where(eq(schema.discoveryPackages.dealId, dealId))
        : db.insert(schema.discoveryPackages).values({ dealId, fields: packageResult.fields }),
    );
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  const readiness = packageResult.readiness;
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: "call_ingested",
    readinessScore: readiness,
    metadata: { callId, title: call.title, fieldsImproved: packageResult.fieldsImproved, selection },
  });
  return { readiness, fieldsImproved: packageResult.fieldsImproved };
}

export async function dismissCallReview(ctx: AuthContext, dealId: string, callId: string): Promise<void> {
  assertSalesManager(ctx, "dismiss_discovery_review");
  const { db, deal, call } = await reviewContext(ctx, dealId, callId);
  if (call.reviewStatus !== "pending") throw new StageError("INVALID_STATE", "This discovery review is already resolved.");
  await db.batch([
    db.update(schema.dealCalls)
      .set({ reviewStatus: "dismissed", reviewedByUserId: ctx.user.id, reviewedAt: new Date() })
      .where(and(eq(schema.dealCalls.id, callId), eq(schema.dealCalls.reviewStatus, "pending"))),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "deal.discovery_review_dismissed",
        entityType: "deal_call",
        entityId: callId,
        metadata: { dealId },
      }),
    ),
  ]);
}

/**
 * Manually set one Discovery Package field (the actionable-package edit path).
 * Sales manager — this changes readiness, same trust level as ingesting a call.
 * Unlike the AI merge, a human may downgrade; the edit is logged as a
 * `field_edited` process event with the before/after statuses.
 */
export async function setPackageField(
  ctx: AuthContext,
  dealId: string,
  key: string,
  input: { status: string; evidence?: string },
): Promise<{ readiness: number; field: PackageField }> {
  assertSalesManager(ctx, "set_package_field");
  if (!(SOLUTION_CLARITY_FIELDS as readonly string[]).includes(key)) throw new StageError("VALIDATION", "Unknown Discovery Package field.");
  if (!(schema.PACKAGE_FIELD_STATUSES as readonly string[]).includes(input.status)) throw new StageError("VALIDATION", "Status must be ok, partial, or missing.");
  const evidence = input.evidence?.trim().slice(0, 500) || null;

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");

  const previous = await loadPackage(dealId);
  const fieldKey = key as PackageFieldKey;
  const from = previous[fieldKey]?.status ?? "missing";
  const { fields, readiness } = applyManualField(previous, fieldKey, { status: input.status as PackageFieldStatus, evidence });

  const existing = await db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, dealId) });
  await db.batch([
    existing
      ? db.update(schema.discoveryPackages).set({ fields }).where(eq(schema.discoveryPackages.dealId, dealId))
      : db.insert(schema.discoveryPackages).values({ dealId, fields }),
    db.update(schema.deals).set({ readinessScore: readiness }).where(eq(schema.deals.id, dealId)),
  ]);
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: "field_edited",
    readinessScore: readiness,
    metadata: { field: key, from, to: input.status, source: "manual" },
  });

  return { readiness, field: fields[fieldKey] as PackageField };
}

/** Manually classify one Buying path signal using the same evidence interaction as Discovery. */
export async function setBuyingPathField(
  ctx: AuthContext,
  dealId: string,
  key: string,
  input: { status: string; evidence?: string; budgetStatus?: string },
): Promise<{ buyingPath: BuyingPath; field: PackageField }> {
  assertSalesManager(ctx, "set_buying_path_field");
  if (!(BUYING_PATH_FIELDS as readonly string[]).includes(key)) throw new StageError("VALIDATION", "Unknown buying-path field.");
  if (!(schema.PACKAGE_FIELD_STATUSES as readonly string[]).includes(input.status)) throw new StageError("VALIDATION", "Status must be ok, partial, or missing.");
  const evidence = input.evidence?.trim().slice(0, 500) || null;
  if (input.status === "ok" && !evidence) throw new StageError("VALIDATION", "Evidence is required before a buying-path item can be marked OK.");
  const fieldKey = key as BuyingPathFieldKey;

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");

  let budgetStatus = deal.budgetStatus;
  if (fieldKey === "budget" && input.budgetStatus !== undefined) {
    if (!isBudgetStatus(input.budgetStatus)) throw new StageError("VALIDATION", "Unknown budget status.");
    budgetStatus = input.budgetStatus;
  }
  if (fieldKey === "budget" && input.status === "ok" && budgetStatus !== "funding_path" && budgetStatus !== "confirmed") {
    throw new StageError("VALIDATION", "Funding path must be identified or budget confirmed before this item can be marked OK.");
  }

  const previous = await loadPackage(dealId);
  const from = previous.buyingPath?.[fieldKey]?.status ?? "missing";
  const field: PackageField = { status: input.status as PackageFieldStatus, evidence, source: "manual" };
  const fields: PackageFields = { ...previous, buyingPath: { ...previous.buyingPath, [fieldKey]: field } };
  const dealPatch: Partial<typeof schema.deals.$inferInsert> = fieldKey === "champion"
    ? { champion: evidence }
    : fieldKey === "economicBuyer"
      ? { economicBuyer: evidence }
      : fieldKey === "compellingEvent"
        ? { compellingEvent: evidence }
        : fieldKey === "decisionProcess"
          ? { decisionProcess: evidence }
          : { budgetStatus, budgetEvidence: evidence };

  const existing = await db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, dealId) });
  await db.batch([
    existing
      ? db.update(schema.discoveryPackages).set({ fields }).where(eq(schema.discoveryPackages.dealId, dealId))
      : db.insert(schema.discoveryPackages).values({ dealId, fields }),
    db.update(schema.deals).set(dealPatch).where(eq(schema.deals.id, dealId)),
  ]);
  const updatedDeal = { ...deal, ...dealPatch };
  const buyingPath = buyingPathFrom(updatedDeal, fields.buyingPath);
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: "field_edited",
    readinessScore: readinessFrom(fields),
    metadata: { area: "buying_path", field: key, from, to: input.status, source: "manual" },
  });
  return { buyingPath, field };
}

export async function getCallTranscript(ctx: AuthContext, dealId: string, callId: string): Promise<{ title: string; recordedAt: Date; transcriptMd: string }> {
  assertStaff(ctx, "read_transcript");
  const { call } = await reviewContext(ctx, dealId, callId);
  return { title: call.title, recordedAt: call.recordedAt, transcriptMd: call.transcriptMd };
}

// ---------------------------------------------------------------- the frame-39 nudge

export type ReadinessCheck = {
  score: number;
  tone: "green" | "amber" | "red";
  ready: boolean;
  readyToDraft: boolean;
  readyToSend: boolean;
  buyingPath: BuyingPath;
  failed: { field: string; label: string; status: string; evidence: string | null }[];
  recommendation: string;
};

/** Check separate draft and send evidence thresholds for proposal coaching. */
export async function readinessCheck(ctx: AuthContext, dealId: string): Promise<ReadinessCheck> {
  assertStaff(ctx, "readiness_check");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const fields = await loadPackage(dealId);
  const score = readinessFrom(fields);
  const failed = failedChecks(fields);
  const buyingPath = buyingPathFrom(deal, fields.buyingPath);
  const { readyToDraft, readyToSend } = proposalReadinessFrom(score, buyingPath.status);
  return {
    score,
    tone: readinessTone(score),
    ready: readyToSend,
    readyToDraft,
    readyToSend,
    buyingPath,
    failed,
    recommendation: !readyToDraft
      ? "Keep the draft, then close the open Discovery Package gaps so scope and price are defensible."
      : buyingPath.status !== "confirmed"
        ? "The Discovery Package is complete enough to draft. Before sending, confirm the economic buyer, decision process, compelling event, champion, and funded path."
        : "The Discovery Package and buying path support sending the proposal.",
  };
}

/** Log a nudge outcome from the UI (fired / acted / overridden). Staff. */
export async function recordNudgeOutcome(
  ctx: AuthContext,
  dealId: string,
  outcome: "fired" | "acted" | "overridden",
  metadata?: unknown,
): Promise<void> {
  assertStaff(ctx, "nudge_outcome");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const fields = await loadPackage(dealId);
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: outcome === "fired" ? "nudge_fired" : outcome === "acted" ? "nudge_acted" : "nudge_overridden",
    readinessScore: readinessFrom(fields),
    metadata: metadata ?? null,
  });
}

// ---------------------------------------------------------------- training mode

/** Is training mode on for the current user? (Sidebar card + board nudge chrome.) */
export async function trainingModeFor(ctx: AuthContext): Promise<boolean> {
  if (!ctx.isStaff) return false;
  const me = await getDb().query.users.findFirst({ where: eq(schema.users.id, ctx.user.id) });
  return !!me?.trainingMode;
}

export async function setTrainingMode(ctx: AuthContext, targetUserId: string, on: boolean): Promise<void> {
  assertStaff(ctx, "set_training_mode");
  if (targetUserId !== ctx.user.id && !ctx.isAdmin) {
    throw new StageError("FORBIDDEN", "Only an admin can set training mode for someone else.");
  }
  const db = getDb();
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, targetUserId) });
  if (!target || target.userType !== "wahala") throw new StageError("NOT_FOUND", "Staff user not found.");
  await db.update(schema.users).set({ trainingMode: on }).where(eq(schema.users.id, targetUserId));
}

// ---------------------------------------------------------------- post-mortem (frame 40)

/**
 * Auto-generate the post-mortem when a deal lands on Lost. Deterministic —
 * timeline + findings come from process_events divergences against the model's
 * expectations, written cause → consequence → counterfactual. No gut feel.
 */
export async function generatePostMortem(dealId: string, actorUserId: string | null, reason: string | null): Promise<void> {
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) return;
  const [events, proposals, fields] = await Promise.all([
    db.select().from(schema.processEvents).where(eq(schema.processEvents.dealId, dealId)).orderBy(schema.processEvents.createdAt),
    db.select().from(schema.proposals).where(eq(schema.proposals.dealId, dealId)),
    loadPackage(dealId),
  ]);

  const moves = events.filter((e) => e.kind === "stage_moved");
  const overrides = events.filter((e) => e.kind === "nudge_overridden");
  const fired = events.filter((e) => e.kind === "nudge_fired");
  const acted = events.filter((e) => e.kind === "nudge_acted");
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const daysLived = Math.max(0, Math.round((Date.now() - deal.createdAt.getTime()) / 86_400_000));

  // Timeline: one line per stage move, with divergence flags underneath.
  const timeline: string[] = [`- **captured** — ${fmt(deal.createdAt)}`];
  for (const m of moves) {
    const label = (s: string | null) => (s && s in STAGE_META ? STAGE_META[s as DealStage].label : (s ?? "?"));
    timeline.push(`- **${label(m.fromStep)} → ${label(m.toStep)}** — ${fmt(m.createdAt)}${m.readinessScore !== null ? ` · Discovery ${m.readinessScore}/10` : ""}`);
    if (m.toStep === "proposal_out" && m.readinessScore !== null && m.readinessScore < PROPOSAL_READY_AT) {
      timeline.push(`  ⚠ proposal sent below the Discovery threshold (${m.readinessScore}/${PROPOSAL_READY_AT} expected)`);
    }
  }

  // Findings: cause → consequence → counterfactual, max 3, from real divergences.
  const findings: string[] = [];
  if (!deal.economicBuyer?.trim()) {
    findings.push(
      `**Economic buyer never identified.** The proposal went out without knowing who could authorize the money → nobody inside the account had to say yes → confirming the economic buyer before sending would have surfaced the real buying path or disqualified the deal early.`,
    );
  }
  const advBelow = moves.find((m) => m.toStep === "proposal_out" && m.readinessScore !== null && m.readinessScore < PROPOSAL_READY_AT);
  if (advBelow) {
    findings.push(
      `**Proposal sent at DISCOVERY ${advBelow.readinessScore}/10** (expected ≥ ${PROPOSAL_READY_AT}). The proposal was written on thin discovery evidence → it argued price instead of the customer's own pain → holding one more discovery call would have either armed the proposal or saved the effort.`,
    );
  }
  if (overrides.length > 0) {
    findings.push(
      `**${overrides.length} nudge${overrides.length === 1 ? "" : "s"} overridden** (${fired.length} fired · ${acted.length} acted on). The process flagged the risk in real time → the override removed the safety margin → treating an override as a debt to repay (do the skipped step next) keeps speed without losing the signal.`,
    );
  }
  const sent = proposals.find((p) => p.sentAt);
  if (sent?.sentAt && !sent.respondedAt) {
    const silentDays = Math.round((Date.now() - sent.sentAt.getTime()) / 86_400_000);
    if (silentDays > FOLLOWUP_EXPECTED_DAYS) {
      findings.push(
        `**Proposal went silent ${silentDays} days** (follow-up expected within ${FOLLOWUP_EXPECTED_DAYS}). Silence read as consideration but was drift → a scheduled follow-up call booked AT send time makes silence impossible.`,
      );
    }
  }
  const singleOption = proposals.length > 0 && proposals.every((p) => p.selectedOptionId === null) && findings.length < 3;
  void singleOption;

  const md = [
    `## Post-mortem — auto-generated`,
    ``,
    `**Lost after ${daysLived} days** · ${reason?.trim() ? `reason: ${reason.trim()}` : "no reason logged"}`,
    ``,
    `### Actual vs. expected`,
    ...timeline,
    ``,
    `### What could have gone better`,
    ...(findings.length > 0 ? findings.slice(0, 3).map((f, i) => `${i + 1}. ${f}`) : ["1. No process divergences logged — this one may simply have been the wrong fit."]),
    ``,
    `_Logged to the deal + account timeline · scorecard math comes only from process events._`,
  ].join("\n");

  await db.update(schema.deals).set({ postMortemMd: md }).where(eq(schema.deals.id, dealId));
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId,
    kind: "postmortem_created",
    readinessScore: readinessFrom(fields),
    metadata: { findings: findings.length, reason },
  });
}

// ---------------------------------------------------------------- scorecard (frame 41)

export type ScorecardRow = {
  userId: string;
  name: string;
  trainingMode: boolean;
  openDeals: number;
  openValueCents: number;
  won: number;
  lost: number;
  winRatePct: number | null;
  /** Avg solution-clarity snapshot on forward moves (null = no moves logged). */
  readinessAtAdvance: number | null;
  /** acted / (acted + overridden), percent. */
  nudgeResponsePct: number | null;
  overrides: number;
  /** Overrides on deals that later closed lost. */
  overridesBeforeLoss: number;
  avgDaysBetweenMoves: number | null;
  signal: { tone: "green" | "amber" | "cobalt"; label: string };
};

const FORWARD: Record<string, number> = { discovery: 1, proposal_out: 2, negotiating: 3, committed: 4, won: 5 };

/** Per-admin process health — math comes only from process_events + deals. */
export async function teamScorecard(ctx: AuthContext): Promise<ScorecardRow[]> {
  if (!ctx.isAdmin) throw new StageError("FORBIDDEN", "Owners only.");
  const db = getDb();
  const [staff, deals, events] = await Promise.all([
    db
      .select({ id: schema.users.id, name: schema.users.name, trainingMode: schema.users.trainingMode })
      .from(schema.users)
      .where(and(eq(schema.users.userType, "wahala"), eq(schema.users.status, "active"))),
    db.select().from(schema.deals),
    db.select().from(schema.processEvents),
  ]);
  const lostDealIds = new Set(deals.filter((d) => d.stage === "lost").map((d) => d.id));

  return staff
    .map((u) => {
      const mine = deals.filter((d) => d.ownerUserId === u.id);
      const myEvents = events.filter((e) => e.ownerUserId === u.id);
      const advances = myEvents.filter(
        (e) => e.kind === "stage_moved" && e.toStep && e.fromStep && (FORWARD[e.toStep] ?? 0) > (FORWARD[e.fromStep] ?? 0),
      );
      const withScore = advances.filter((e) => e.readinessScore !== null);
      const acted = myEvents.filter((e) => e.kind === "nudge_acted").length;
      const overridden = myEvents.filter((e) => e.kind === "nudge_overridden");
      const won = mine.filter((d) => d.stage === "won").length;
      const lost = mine.filter((d) => d.stage === "lost").length;
      const open = mine.filter((d) => d.stage !== "won" && d.stage !== "lost");

      // Avg gap between consecutive stage moves per deal (proxy for days stuck).
      const gaps: number[] = [];
      const byDeal = new Map<string, Date[]>();
      for (const e of myEvents.filter((e) => e.kind === "stage_moved")) {
        const arr = byDeal.get(e.dealId) ?? [];
        arr.push(e.createdAt);
        byDeal.set(e.dealId, arr);
      }
      for (const dates of byDeal.values()) {
        for (let i = 1; i < dates.length; i++) gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000);
      }

      const readinessAtAdvance = withScore.length
        ? Math.round((withScore.reduce((n, e) => n + (e.readinessScore as number), 0) / withScore.length) * 10) / 10
        : null;
      const nudgeResponsePct = acted + overridden.length > 0 ? Math.round((acted / (acted + overridden.length)) * 100) : null;
      const overridesBeforeLoss = overridden.filter((e) => lostDealIds.has(e.dealId)).length;
      const closed = won + lost;

      const signal: ScorecardRow["signal"] = u.trainingMode
        ? { tone: "cobalt", label: "↗ ramping" }
        : overridesBeforeLoss >= 2 || (readinessAtAdvance !== null && readinessAtAdvance < PROPOSAL_READY_AT)
          ? { tone: "amber", label: "⚠ pattern" }
          : { tone: "green", label: "▲ on process" };

      return {
        userId: u.id,
        name: u.name,
        trainingMode: u.trainingMode,
        openDeals: open.length,
        openValueCents: open.reduce((n, d) => n + d.valueCents, 0),
        won,
        lost,
        winRatePct: closed > 0 ? Math.round((won / closed) * 100) : null,
        readinessAtAdvance,
        nudgeResponsePct,
        overrides: overridden.length,
        overridesBeforeLoss,
        avgDaysBetweenMoves: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null,
        signal,
      };
    })
    .sort((a, b) => b.openValueCents - a.openValueCents);
}

/** The frame-41 signals band: max 2 insight cards, conversation starters. */
export function scorecardSignals(rows: ScorecardRow[]): { tone: "amber" | "green"; title: string; body: string }[] {
  const out: { tone: "amber" | "green"; title: string; body: string }[] = [];
  const risky = rows.find((r) => r.overridesBeforeLoss >= 2);
  if (risky) {
    out.push({
      tone: "amber",
      title: `${risky.name} — overrides preceding losses`,
      body: `${risky.overridesBeforeLoss} of ${risky.overrides} overrides sat on deals that later closed lost. Monday question: which skipped step would have changed the outcome?`,
    });
  }
  const low = rows.find((r) => r !== risky && r.readinessAtAdvance !== null && r.readinessAtAdvance < PROPOSAL_READY_AT);
  if (low && out.length < 2) {
    out.push({
      tone: "amber",
      title: `${low.name} — thin Discovery Package at advance`,
      body: `Average Discovery at advance is ${low.readinessAtAdvance}/10 (expected ≥ ${PROPOSAL_READY_AT}). Ask which missing discovery evidence would make scope and price safer.`,
    });
  }
  const strong = rows.find((r) => r.readinessAtAdvance !== null && r.readinessAtAdvance >= PROPOSAL_READY_AT && (r.nudgeResponsePct ?? 0) >= 85);
  if (strong && out.length < 2) {
    out.push({
      tone: "green",
      title: `${strong.name} — top process health`,
      body: `${strong.readinessAtAdvance}/10 Discovery at advance · ${strong.nudgeResponsePct}% nudge response.${strong.trainingMode ? " Suggest turning training mode off next month." : " Worth sharing their discovery routine at the Monday meeting."}`,
    });
  }
  return out.slice(0, 2);
}

// Re-exported for the scorecard label copy.
export { PACKAGE_FIELD_LABELS };
