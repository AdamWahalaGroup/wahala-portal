/**
 * Process service (TRAINING-AND-SCORECARD.md, frames 38–41) — the ONE process
 * model, rendered three ways:
 *   forward  → guidance (training mode: goal rail, package card, next best action)
 *   at a move → nudges (frame 39: proposal-ready check; overrides logged, never blocked)
 *   backward → measurement (frame 40 post-mortem, frame 41 scorecard)
 *
 * Everything measurable comes from the append-only process_events table — no
 * gut-feel fields. Readiness recomputes from Discovery Package completeness after
 * every ingested call; history keeps per-event snapshots, never mutated.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager, assertStaff } from "@/services/sales";
import { daysInStage, STAGE_META, type DealStage } from "@/domain/sales";
import {
  readinessFrom,
  readinessTone,
  failedChecks,
  goalFor,
  nextBestActions,
  journeyIndex,
  JOURNEY,
  PROPOSAL_READY_AT,
  FOLLOWUP_EXPECTED_DAYS,
  PACKAGE_FIELD_LABELS,
  type PackageFields,
  type NextAction,
} from "@/domain/process";
import { getDraftProvider, type DraftUsage } from "@/services/ai/provider";
import { resolveAgentConfig } from "@/services/ai/agent-config";

type ProcessEventKind = (typeof schema.PROCESS_EVENT_KINDS)[number];

// ---------------------------------------------------------------- event log (append-only)

/** Low-level append — call from services after their own auth checks. */
export async function recordProcessEvent(input: {
  organizationId: string;
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

// ---------------------------------------------------------------- package + readiness

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
  calls: { id: string; title: string; recordedAt: Date; durationMin: number | null; fieldsExtracted: number }[];
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
  const readiness = deal.readinessScore;
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
    goal: goalFor(deal.stage, readiness, daysInStage(deal.stageEnteredAt, new Date())),
    nextActions: nextBestActions({
      stage: deal.stage,
      readiness,
      hasDiscoveryMd: !!deal.discoveryMd,
      proposalStatus,
      complexityScore: open[0]?.complexityScore ?? null,
      depositPaid: !!deal.depositPaidAt,
    }),
    calls: calls.map((c) => ({ id: c.id, title: c.title, recordedAt: c.recordedAt, durationMin: c.durationMin, fieldsExtracted: c.fieldsExtracted })),
  };
}

// ---------------------------------------------------------------- call ingestion (AI extraction)

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "fieldsImproved"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: [...schema.PACKAGE_FIELDS],
      properties: Object.fromEntries(
        schema.PACKAGE_FIELDS.map((k) => [
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
  },
} as const;

type ExtractionOutput = {
  fields: Record<string, { status: "ok" | "partial" | "missing"; evidence: string; source: string }>;
  fieldsImproved: number;
};

/**
 * Ingest a recorded call: store the transcript, run the package extractor, merge
 * the 10 fields, recompute readiness (snapshot logged). Sales manager (costs money).
 */
export async function ingestCall(
  ctx: AuthContext,
  dealId: string,
  input: { title: string; transcriptMd: string; recordedAt?: string; durationMin?: number },
): Promise<{ callId: string; readiness: number; fieldsExtracted: number; usage: DraftUsage }> {
  assertSalesManager(ctx, "ingest_call");
  const title = input.title?.trim();
  const transcript = input.transcriptMd?.trim();
  if (!title) throw new StageError("VALIDATION", "Give the call a title.");
  if (!transcript) throw new StageError("VALIDATION", "Paste the transcript.");

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");

  const previous = await loadPackage(dealId);
  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("package_extractor");
  const { output, usage } = await provider.completeStructured<ExtractionOutput>({
    system: cfg.systemPrompt,
    parts: [
      { kind: "text", text: `CURRENT PACKAGE (JSON):\n${JSON.stringify(previous)}` },
      { kind: "text", text: `CALL TITLE: ${title}\n\nTRANSCRIPT:\n${transcript.slice(0, 120_000)}` },
    ],
    schemaName: "discovery_package",
    schema: extractionSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });

  // Merge rule: a field never gets WORSE because a later call didn't mention it.
  const rank = { missing: 0, partial: 1, ok: 2 } as const;
  const merged: PackageFields = { ...previous };
  for (const key of schema.PACKAGE_FIELDS) {
    const next = output.fields[key];
    if (!next) continue;
    const prev = previous[key];
    if (!prev || rank[next.status] >= rank[prev.status]) {
      merged[key] = { status: next.status, evidence: next.evidence || prev?.evidence || null, source: next.source || prev?.source || null };
    }
  }
  const readiness = readinessFrom(merged);
  const callId = crypto.randomUUID();

  const existing = await db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, dealId) });
  await db.batch([
    db.insert(schema.dealCalls).values({
      id: callId,
      dealId,
      title,
      recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      durationMin: input.durationMin ?? null,
      transcriptMd: transcript,
      fieldsExtracted: Math.max(0, Math.min(10, Math.round(output.fieldsImproved))),
      createdByUserId: ctx.user.id,
    }),
    existing
      ? db.update(schema.discoveryPackages).set({ fields: merged }).where(eq(schema.discoveryPackages.dealId, dealId))
      : db.insert(schema.discoveryPackages).values({ dealId, fields: merged }),
    db.update(schema.deals).set({ readinessScore: readiness }).where(eq(schema.deals.id, dealId)),
  ]);
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: "call_ingested",
    readinessScore: readiness,
    metadata: { callId, title, fieldsImproved: output.fieldsImproved },
  });

  return { callId, readiness, fieldsExtracted: output.fieldsImproved, usage };
}

export async function getCallTranscript(ctx: AuthContext, dealId: string, callId: string): Promise<{ title: string; recordedAt: Date; transcriptMd: string }> {
  assertStaff(ctx, "read_transcript");
  const row = await getDb().query.dealCalls.findFirst({ where: eq(schema.dealCalls.id, callId) });
  if (!row || row.dealId !== dealId) throw new StageError("NOT_FOUND", "Call not found.");
  return { title: row.title, recordedAt: row.recordedAt, transcriptMd: row.transcriptMd };
}

// ---------------------------------------------------------------- the frame-39 nudge

export type ReadinessCheck = {
  score: number;
  tone: "green" | "amber" | "red";
  ready: boolean;
  failed: { field: string; label: string; status: string; evidence: string | null }[];
  recommendation: string;
};

/** Is this deal proposal-ready? Feeds both the modal (training on) and the inline warning. */
export async function readinessCheck(ctx: AuthContext, dealId: string): Promise<ReadinessCheck> {
  assertStaff(ctx, "readiness_check");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const fields = await loadPackage(dealId);
  const score = deal.readinessScore ?? readinessFrom(fields);
  const failed = failedChecks(fields);
  const needsDecisionMaker = failed.some((f) => f.field === "decision_makers");
  return {
    score,
    tone: readinessTone(score),
    ready: score >= PROPOSAL_READY_AT,
    failed,
    recommendation: needsDecisionMaker
      ? "Stay in Discovery — book a working session WITH the decision maker in the room, and send a pre-meeting questionnaire covering the open fields."
      : "Stay in Discovery — one more call closing the open fields below, then draft the proposal.",
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
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: outcome === "fired" ? "nudge_fired" : outcome === "acted" ? "nudge_acted" : "nudge_overridden",
    readinessScore: deal.readinessScore,
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
    timeline.push(`- **${label(m.fromStep)} → ${label(m.toStep)}** — ${fmt(m.createdAt)}${m.readinessScore !== null ? ` · readiness ${m.readinessScore}/10` : ""}`);
    if (m.toStep === "proposal_out" && m.readinessScore !== null && m.readinessScore < PROPOSAL_READY_AT) {
      timeline.push(`  ⚠ advanced below proposal-ready (${m.readinessScore}/${PROPOSAL_READY_AT} expected)`);
    }
  }

  // Findings: cause → consequence → counterfactual, max 3, from real divergences.
  const findings: string[] = [];
  const dm = fields.decision_makers?.status ?? "missing";
  if (dm !== "ok") {
    findings.push(
      `**Decision maker never identified.** The proposal went to whoever answered${fields.decision_makers?.evidence ? ` (“${fields.decision_makers.evidence}”)` : ""} → nobody inside the account had to say yes → a working session with the named decision maker before drafting would have surfaced the real buyer or disqualified the deal early.`,
    );
  }
  const advBelow = moves.find((m) => m.toStep === "proposal_out" && m.readinessScore !== null && m.readinessScore < PROPOSAL_READY_AT);
  if (advBelow) {
    findings.push(
      `**Advanced at ${advBelow.readinessScore}/10 readiness** (expected ≥ ${PROPOSAL_READY_AT}). The proposal was written on a thin package → it argued price instead of the customer's own pain → holding one more discovery call would have either armed the proposal or saved the effort.`,
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
    readinessScore: deal.readinessScore,
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
  /** Avg readiness snapshot on FORWARD moves (null = no moves logged). */
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
      title: `${low.name} — advancing below proposal-ready`,
      body: `Average readiness at advance is ${low.readinessAtAdvance}/10 (expected ≥ ${PROPOSAL_READY_AT}). Suggest one more discovery call per deal before drafting.`,
    });
  }
  const strong = rows.find((r) => r.readinessAtAdvance !== null && r.readinessAtAdvance >= PROPOSAL_READY_AT && (r.nudgeResponsePct ?? 0) >= 85);
  if (strong && out.length < 2) {
    out.push({
      tone: "green",
      title: `${strong.name} — top process health`,
      body: `${strong.readinessAtAdvance}/10 readiness at advance · ${strong.nudgeResponsePct}% nudge response.${strong.trainingMode ? " Suggest turning training mode off next month." : " Worth sharing their discovery routine at the Monday meeting."}`,
    });
  }
  return out.slice(0, 2);
}

// Re-exported for the scorecard label copy.
export { PACKAGE_FIELD_LABELS };
