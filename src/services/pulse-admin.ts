/**
 * Main-app entries to the agent layer (routes stay getDb-free per the DB
 * chokepoint): run the pulse on demand, and meter AI runs from route land.
 */
import { getDb } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { runPulseTick, runPulseAi, type TickResult, type PulseAiResult } from "@/services/pulse";
import { recordAiRun, type AiRunInput } from "@/services/ai/usage";
import { openaiApiKey, aiDraftModel } from "@/auth/server-env";

/** Run the deal pulse now (admin) — the cron does this on schedule; this is the demo/smoke path. */
export async function runPulseNow(ctx: AuthContext): Promise<{ tick: TickResult; ai: PulseAiResult }> {
  if (!ctx.isAdmin) throw new StageError("FORBIDDEN", "Admins only.");
  const db = getDb();
  const now = new Date();
  const tick = await runPulseTick(db, now);
  const ai = await runPulseAi(db, { OPENAI_API_KEY: openaiApiKey(), AI_DRAFT_MODEL: aiDraftModel() }, now);
  return { tick, ai };
}

/** Meter one AI run from a route (thin wrapper so routes never touch getDb). */
export async function meterAiRun(run: AiRunInput): Promise<void> {
  await recordAiRun(getDb(), run);
}
