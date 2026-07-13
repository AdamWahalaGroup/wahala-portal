/**
 * The deal pulse — the per-deal conductor (docs/AGENT-LAYER-DESIGN.md).
 *
 * Two entry points, both cron-safe ((db, env, now) explicitly; relative imports
 * only so the standalone cron Worker bundles this without the `@/` alias):
 *
 * - runPulseTick(db, now): DETERMINISTIC + free. Recomputes momentum and
 *   priority for every open deal. Runs hourly.
 * - runPulseAi(db, env, now): the AI pass. For open deals whose fit is stale
 *   (never scored / >7 days / stage moved since), calls the deal_pulse agent
 *   for a fit score + ≤3 suggestions — UNLESS the deal is over its budget, in
 *   which case it says so once and spends nothing. Runs daily before nudges.
 *
 * The pulse never talks to clients and never mutates sales state — it scores,
 * suggests, and meters money.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { resolveSla } from "../domain/sla";
import { daysInStage } from "../domain/sales";
import { momentumFrom, dealBudgetCents, priorityScore } from "../domain/priority";
import { actionUrgencyScore } from "../domain/deal-operating-model";
import { DEFAULT_AGENT_PROMPTS } from "./ai/prompts";
import { recordAiRun } from "./ai/usage";

type Db = DrizzleD1Database<typeof schema>;

export type PulseEnv = {
  OPENAI_API_KEY?: string;
  AI_DRAFT_MODEL?: string;
};

const APP_BASE = "https://portal.wahala-services.com";
const OPEN_STAGES = ["new", "discovery", "proposal_out", "negotiating", "committed"] as const;
const FIT_STALE_DAYS = 7;
// A system nudge is not relationship activity. Only events caused by actual
// human/client work can refresh engagement health.
const TOUCH_EVENT_KINDS = ["stage_moved", "call_ingested", "field_edited", "nudge_acted"] as const;
/** Per-run cap on AI refreshes — a backstop, not a schedule. */
const MAX_AI_REFRESHES_PER_RUN = 20;

/** Fit needs an AI refresh: never scored, older than a week, or the stage moved since. */
export function fitIsStale(deal: { fitScoredAt: Date | null; stageEnteredAt: Date }, now: Date): boolean {
  if (!deal.fitScoredAt) return true;
  if (deal.fitScoredAt.getTime() < now.getTime() - FIT_STALE_DAYS * 86_400_000) return true;
  return deal.stageEnteredAt.getTime() > deal.fitScoredAt.getTime();
}

// ---------------------------------------------------------------- deterministic tick (hourly)

export type TickResult = { openDeals: number; updated: number };

export async function runPulseTick(db: Db, now: Date): Promise<TickResult> {
  const sla = resolveSla((await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "sla")).get())?.value ?? null);
  const deals = await db.select().from(schema.deals).where(inArray(schema.deals.stage, [...OPEN_STAGES])).all();
  if (deals.length === 0) return { openDeals: 0, updated: 0 };
  const dealIds = deals.map((d) => d.id);

  const [lastEvents, reschedules, sentProposals, upcomingMeetings] = await Promise.all([
    db
      .select({ dealId: schema.processEvents.dealId, last: sql<number>`max(${schema.processEvents.createdAt})` })
      .from(schema.processEvents)
      .where(and(inArray(schema.processEvents.dealId, dealIds), inArray(schema.processEvents.kind, [...TOUCH_EVENT_KINDS])))
      .groupBy(schema.processEvents.dealId)
      .all(),
    db
      .select({ dealId: schema.meetings.dealId, count: sql<number>`sum(${schema.meetings.rescheduleCount})` })
      .from(schema.meetings)
      .where(inArray(schema.meetings.dealId, dealIds))
      .groupBy(schema.meetings.dealId)
      .all(),
    db.select().from(schema.proposals).where(and(eq(schema.proposals.status, "sent"), inArray(schema.proposals.dealId, dealIds))).all(),
    db
      .select({ dealId: schema.meetings.dealId, startsAt: schema.meetings.startsAt })
      .from(schema.meetings)
      .where(and(inArray(schema.meetings.dealId, dealIds), eq(schema.meetings.status, "upcoming"), gte(schema.meetings.startsAt, now)))
      .all(),
  ]);
  const lastEventByDeal = new Map(lastEvents.map((r) => [r.dealId, r.last]));
  const rescheduleByDeal = new Map(reschedules.map((r) => [r.dealId, r.count ?? 0]));
  const nextMeetingByDeal = new Map<string, Date>();
  for (const meeting of upcomingMeetings) {
    if (!meeting.dealId) continue;
    const current = nextMeetingByDeal.get(meeting.dealId);
    if (!current || meeting.startsAt < current) nextMeetingByDeal.set(meeting.dealId, meeting.startsAt);
  }
  const silentByDeal = new Map<string, number>();
  for (const p of sentProposals) {
    if (!p.sentAt || p.respondedAt) continue;
    const days = daysInStage(p.sentAt, now);
    silentByDeal.set(p.dealId, Math.max(silentByDeal.get(p.dealId) ?? 0, days));
  }

  let updated = 0;
  for (const d of deals) {
    const lastEvent = lastEventByDeal.get(d.id);
    // Touch = the latest of stage entry and the last recorded process event.
    // (timestamp-mode columns store epoch seconds — max() returns raw seconds.)
    const lastTouch = Math.max(d.stageEnteredAt.getTime(), lastEvent ? Number(lastEvent) * 1000 : 0);
    const daysSinceTouch = Math.max(0, Math.floor((now.getTime() - lastTouch) / 86_400_000));
    const momentum = momentumFrom({
      daysSinceTouch,
      rescheduleCount: rescheduleByDeal.get(d.id) ?? 0,
      proposalSilentDays: silentByDeal.get(d.id) ?? 0,
    });
    const anchorPct = sla.probabilityAnchors[d.stage] ?? null;
    const priority = priorityScore({ fit: d.fitScore, valueCents: d.valueCents, anchorPct });
    const urgency = actionUrgencyScore({ nextAction: d.nextAction, nextActionDueAt: d.nextActionDueAt, nextMeetingAt: nextMeetingByDeal.get(d.id) ?? null, now });
    if (priority !== d.priorityScore || momentum !== d.engagementHealthScore || urgency !== d.actionUrgencyScore) {
      await db
        .update(schema.deals)
        .set({ priorityScore: priority, engagementHealthScore: momentum, actionUrgencyScore: urgency })
        .where(eq(schema.deals.id, d.id))
        .run();
      updated++;
    }
  }
  return { openDeals: deals.length, updated };
}

// ---------------------------------------------------------------- AI pass (daily)

export type PulseAiResult = { considered: number; refreshed: number; suggestionsCreated: number; budgetSkipped: number };

type PulseOutput = {
  fitScore: number;
  fitRationaleMd: string;
  suggestions: { title: string; bodyMd: string }[];
};

const pulseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fitScore", "fitRationaleMd", "suggestions"],
  properties: {
    fitScore: { type: "integer", minimum: 0, maximum: 10 },
    fitRationaleMd: { type: "string" },
    suggestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "bodyMd"],
        properties: { title: { type: "string" }, bodyMd: { type: "string" } },
      },
    },
  },
} as const;

/** Per-1M-token prices (USD) — local copy; keep fractional cents (no rounding). */
const PRICING: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  "gpt-4o-mini": { inPerMTok: 0.15, outPerMTok: 0.6 },
  "gpt-4o": { inPerMTok: 2.5, outPerMTok: 10.0 },
};
function costCentsFor(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? PRICING["gpt-4o-mini"];
  return ((inTok / 1_000_000) * p.inPerMTok + (outTok / 1_000_000) * p.outPerMTok) * 100;
}

export async function runPulseAi(db: Db, env: PulseEnv, now: Date): Promise<PulseAiResult> {
  const result: PulseAiResult = { considered: 0, refreshed: 0, suggestionsCreated: 0, budgetSkipped: 0 };
  if (!env.OPENAI_API_KEY) return result; // pulse AI silently off until the key is bound

  const sla = resolveSla((await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "sla")).get())?.value ?? null);
  const cfgRow = (await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "agent:deal_pulse")).get())?.value as
    | { model?: string; systemPrompt?: string }
    | undefined;
  const model = cfgRow?.model || env.AI_DRAFT_MODEL || "gpt-4o-mini";
  const system = cfgRow?.systemPrompt || DEFAULT_AGENT_PROMPTS.deal_pulse;

  const deals = await db.select().from(schema.deals).where(inArray(schema.deals.stage, [...OPEN_STAGES])).all();
  // Oldest/unscored first so the per-run cap cannot starve later table rows.
  const due = deals
    .filter((d) => fitIsStale(d, now))
    .sort((a, b) => (a.fitScoredAt?.getTime() ?? 0) - (b.fitScoredAt?.getTime() ?? 0));
  result.considered = due.length;

  const unreadNotifs = await db
    .select()
    .from(schema.notifications)
    .where(and(inArray(schema.notifications.kind, ["suggestion", "budget_exhausted"]), sql`${schema.notifications.readAt} IS NULL`))
    .all();
  const unreadKey = new Set(unreadNotifs.map((r) => `${r.userId}:${r.kind}:${r.entityId}`));

  for (const deal of due.slice(0, MAX_AI_REFRESHES_PER_RUN)) {
    const anchorPct = sla.probabilityAnchors[deal.stage] ?? null;
    const budget = dealBudgetCents(deal.valueCents, anchorPct);

    // The money guardrail: over budget → no spend, say so once, move on.
    if (deal.agentSpendCents >= budget) {
      result.budgetSkipped++;
      if (deal.ownerUserId && !unreadKey.has(`${deal.ownerUserId}:budget_exhausted:${deal.id}`)) {
        await db.insert(schema.notifications).values({
          userId: deal.ownerUserId,
          kind: "budget_exhausted",
          entityType: "deal",
          entityId: deal.id,
          href: `${APP_BASE}/dashboard/sales/deals/${deal.id}`,
          title: `Agent budget spent: ${deal.name}`,
          body: `$${(deal.agentSpendCents / 100).toFixed(2)} of $${(budget / 100).toFixed(2)} used — the pulse paused AI work here. Raise the deal value or work it by hand.`,
        }).run();
      }
      continue;
    }

    const digest = await groundedDigest(db, deal, now);
    let out: PulseOutput;
    let usage: { inputTokens: number; outputTokens: number };
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: digest },
          ],
          response_format: { type: "json_schema", json_schema: { name: "deal_pulse", strict: true, schema: pulseJsonSchema } },
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      out = JSON.parse(data.choices[0]?.message?.content ?? "{}") as PulseOutput;
      usage = { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
    } catch (e) {
      console.error(`[pulse] deal ${deal.id} AI pass failed (non-fatal)`, e);
      continue;
    }

    const costCents = costCentsFor(model, usage.inputTokens, usage.outputTokens);
    await recordAiRun(db, {
      agentKey: "deal_pulse",
      trigger: "cron",
      dealId: deal.id,
      organizationId: deal.organizationId,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costCents,
    });

    const fit = Math.max(0, Math.min(10, Math.round(out.fitScore)));
    // AI analysis is not a customer touch. Preserve the deterministic health
    // score and update only portfolio attractiveness.
    const priority = priorityScore({ fit, valueCents: deal.valueCents, anchorPct });
    await db
      .update(schema.deals)
      .set({ fitScore: fit, fitRationaleMd: out.fitRationaleMd?.trim() || null, fitScoredAt: now, priorityScore: priority })
      .where(eq(schema.deals.id, deal.id))
      .run();
    result.refreshed++;

    // Suggestion box upsert — dedupe against OPEN and DONE suggestions by title
    // (done ones stay visible struck-through; recreating them would sit a fresh
    // copy next to its completed twin).
    const existingSuggestions = await db
      .select()
      .from(schema.suggestions)
      .where(and(eq(schema.suggestions.dealId, deal.id), inArray(schema.suggestions.status, ["open", "done"])))
      .all();
    const existingTitles = new Set(existingSuggestions.map((s) => s.title.toLowerCase()));
    const fresh = (out.suggestions ?? [])
      .filter((s) => s.title?.trim())
      .filter((s) => !existingTitles.has(s.title.trim().toLowerCase()))
      .slice(0, 3);
    if (fresh.length > 0) {
      await db
        .insert(schema.suggestions)
        .values(fresh.map((s) => ({ dealId: deal.id, organizationId: deal.organizationId, agentKey: "deal_pulse", title: s.title.trim(), bodyMd: s.bodyMd?.trim() || null })))
        .run();
      result.suggestionsCreated += fresh.length;
      if (deal.ownerUserId && !unreadKey.has(`${deal.ownerUserId}:suggestion:${deal.id}`)) {
        await db.insert(schema.notifications).values({
          userId: deal.ownerUserId,
          kind: "suggestion",
          entityType: "deal",
          entityId: deal.id,
          href: `${APP_BASE}/dashboard/sales/deals/${deal.id}`,
          title: `${fresh.length} suggestion${fresh.length === 1 ? "" : "s"} on ${deal.name}`,
          body: fresh.map((s) => s.title).join(" · "),
        }).run();
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------- grounding

/** Compact grounded digest of ONE deal — everything the pulse may reason from. */
async function groundedDigest(db: Db, deal: typeof schema.deals.$inferSelect, now: Date): Promise<string> {
  const [pkg, events, meetings, proposals, org, openSuggestions] = await Promise.all([
    db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, deal.id) }),
    db
      .select()
      .from(schema.processEvents)
      .where(eq(schema.processEvents.dealId, deal.id))
      .orderBy(sql`${schema.processEvents.createdAt} desc`)
      .limit(10)
      .all(),
    db.select().from(schema.meetings).where(eq(schema.meetings.dealId, deal.id)).all(),
    db.select().from(schema.proposals).where(eq(schema.proposals.dealId, deal.id)).all(),
    deal.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }) : null,
    db.select({ title: schema.suggestions.title }).from(schema.suggestions).where(and(eq(schema.suggestions.dealId, deal.id), inArray(schema.suggestions.status, ["open", "done"]))).all(),
  ]);

  const lines: string[] = [
    `DEAL: ${deal.name}`,
    `Stage: ${deal.stage} (${daysInStage(deal.stageEnteredAt, now)} days in stage) · value $${Math.round(deal.valueCents / 100).toLocaleString("en-US")} (gut number)`,
    `Account: ${org ? `${org.name} (${org.status})` : "none yet — opportunity on a contact"}`,
    `Readiness: ${deal.readinessScore ?? "unscored"} / 10${deal.subStatus ? ` · substatus: ${deal.subStatus}` : ""}`,
    `Engagement type: ${deal.engagementType ?? "unclassified"} · delivery: ${deal.deliveryModel ?? "unclassified"}`,
    `IP: ${deal.ipDisposition} · data sensitivity: ${deal.dataSensitivity}`,
    `Agreed follow-up: ${deal.nextAction ?? "MISSING"}${deal.nextActionDueAt ? ` · due ${deal.nextActionDueAt.toISOString().slice(0, 10)}` : " · due date MISSING"} · court: ${deal.nextActionCourt}`,
    `Qualification: champion ${deal.champion ?? "unknown"} · economic buyer ${deal.economicBuyer ?? "unknown"} · budget ${deal.budgetStatus}`,
  ];
  if (deal.compellingEvent) lines.push(`Compelling event: ${deal.compellingEvent}`);
  if (deal.decisionProcess) lines.push(`Decision process: ${deal.decisionProcess}`);
  if (deal.budgetEvidence) lines.push(`Budget evidence: ${deal.budgetEvidence}`);
  if (deal.discoveryNote) lines.push(`Discovery note: ${deal.discoveryNote}`);
  if (deal.notes) lines.push(`Deal notes: ${deal.notes.slice(0, 800)}`);
  if (pkg) {
    const fields = pkg.fields as Record<string, { status: string; evidence?: string | null }>;
    lines.push(
      "DISCOVERY PACKAGE:",
      ...Object.entries(fields).map(([k, v]) => `- ${k}: ${v.status}${v.evidence ? ` — "${String(v.evidence).slice(0, 160)}"` : ""}`),
    );
  }
  if (meetings.length > 0) {
    const totalReschedules = meetings.reduce((n, m) => n + m.rescheduleCount, 0);
    const upcoming = meetings.filter((m) => m.status === "upcoming" && m.startsAt.getTime() > now.getTime());
    lines.push(`MEETINGS: ${meetings.length} total · ${totalReschedules} reschedule${totalReschedules === 1 ? "" : "s"} · ${upcoming.length} upcoming`);
  }
  if (proposals.length > 0) {
    lines.push(
      "PROPOSALS:",
      ...proposals.map((p) => {
        const silent = p.status === "sent" && p.sentAt && !p.respondedAt ? ` · silent ${daysInStage(p.sentAt, now)}d` : "";
        return `- v${p.version}: ${p.status}${silent}`;
      }),
    );
  }
  if (events.length > 0) {
    lines.push(
      "RECENT EVENTS (newest first):",
      ...events.map((e) => `- ${e.kind}${e.fromStep ? ` ${e.fromStep}→${e.toStep}` : ""} (${e.createdAt.toISOString().slice(0, 10)})`),
    );
  }
  if (openSuggestions.length > 0) {
    lines.push("OPEN SUGGESTIONS ALREADY IN THE BOX (do not repeat):", ...openSuggestions.map((s) => `- ${s.title}`));
  }
  return lines.join("\n");
}
