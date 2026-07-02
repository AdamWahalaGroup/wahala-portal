/**
 * wahala-nudges — standalone cron Worker. Fires daily; delegates to the pure
 * runNudges engine in src/services/nudges.ts (shared with the main app). Kept
 * separate from the OpenNext main worker so it never touches its regenerated,
 * fetch-only entry, and so `env` is available directly (no request context).
 */
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../src/db/schema";
import { runNudges } from "../src/services/nudges";
import type { EmailEnv } from "../src/auth/send-email";

export interface Env {
  DB: D1Database;
  EMAIL: unknown;
  EMAIL_FROM?: string;
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const db = drizzle(env.DB, { schema });
    ctx.waitUntil(
      runNudges(db, env as unknown as EmailEnv, new Date(controller.scheduledTime))
        .then((r) => console.log("[nudges]", JSON.stringify(r)))
        .catch((e) => console.error("[nudges] failed:", e)),
    );
  },
};
