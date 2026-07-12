/**
 * The money meter (docs/AGENT-LAYER-DESIGN.md): every AI call lands here so
 * budgets are real. costCents is the same local estimate DraftUsage carries.
 * Relative imports only — the cron worker bundles this via services/pulse.
 */
import { eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export type Db = DrizzleD1Database<typeof schema>;

export type AiRunInput = {
  agentKey: string;
  trigger?: (typeof schema.AI_RUN_TRIGGERS)[number];
  dealId?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
};

/**
 * Persist one AI run and bump the deal's running spend total. Never throws —
 * metering must not break the feature that ran the model.
 */
export async function recordAiRun(db: Db, run: AiRunInput): Promise<void> {
  try {
    await db.insert(schema.aiRuns).values({
      agentKey: run.agentKey,
      trigger: run.trigger ?? "user",
      dealId: run.dealId ?? null,
      contactId: run.contactId ?? null,
      organizationId: run.organizationId ?? null,
      model: run.model,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      costCents: run.costCents,
    });
    if (run.dealId) {
      await db
        .update(schema.deals)
        .set({ agentSpendCents: sql`${schema.deals.agentSpendCents} + ${run.costCents}` })
        .where(eq(schema.deals.id, run.dealId));
    }
  } catch (e) {
    console.error("recordAiRun failed (non-fatal)", e);
  }
}
