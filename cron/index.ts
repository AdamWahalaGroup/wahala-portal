/**
 * wahala-nudges — standalone cron Worker. Kept separate from the OpenNext main
 * worker so it never touches its regenerated, fetch-only entry, and so `env`
 * is available directly (no request context).
 *
 * Two triggers (see wrangler.jsonc):
 * - hourly  → runPulseTick: deterministic momentum/priority recompute (free).
 * - daily   → runPulseAi (fit + suggestions, budget-gated) then runNudges
 *             (SLA nudges, escalation emails, admin digest).
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../src/db/schema";
import { runNudges } from "../src/services/nudges";
import { runPulseTick, runPulseAi } from "../src/services/pulse";
import type { EmailEnv } from "../src/auth/send-email";

export interface Env {
  DB: D1Database;
  EMAIL: unknown;
  EMAIL_FROM?: string;
  /** Secret (wrangler secret put OPENAI_API_KEY -c cron/wrangler.jsonc). Absent → pulse AI pass is silently off. */
  OPENAI_API_KEY?: string;
  AI_DRAFT_MODEL?: string;
}

const DAILY_CRON = "0 13 * * *";

const worker = {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = drizzle(env.DB, { schema });
    const now = new Date(controller.scheduledTime);

    if (controller.cron === DAILY_CRON) {
      ctx.waitUntil(
        (async () => {
          const ai = await runPulseAi(db, env, now).catch((e) => {
            console.error("[pulse-ai] failed:", e);
            return null;
          });
          if (ai) console.log("[pulse-ai]", JSON.stringify(ai));
          const nudges = await runNudges(db, env as unknown as EmailEnv, now);
          console.log("[nudges]", JSON.stringify(nudges));
        })(),
      );
      return;
    }

    // Hourly: the free deterministic pass.
    ctx.waitUntil(
      runPulseTick(db, now)
        .then((r) => console.log("[pulse-tick]", JSON.stringify(r)))
        .catch((e) => console.error("[pulse-tick] failed:", e)),
    );
  },
};

export default worker;
