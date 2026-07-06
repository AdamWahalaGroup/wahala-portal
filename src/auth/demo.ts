/**
 * Design-review demo mode — a SEPARATE deployment (wrangler.demo.jsonc → its own
 * worker + its own D1/KV/R2, seeded only with fixture data) that renders the real
 * UI with no login. Safety comes from isolation, not scoping: the demo worker's
 * database physically contains no client data, and getDb() refuses writes.
 *
 * DEMO_MODE is set ONLY in wrangler.demo.jsonc. It must never appear in the
 * production wrangler.jsonc or .dev.vars.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Fixed viewer identity — seeded into the demo D1 (falls back to any staff admin). */
export const DEMO_USER_ID = "usr_demo_viewer_0001";

export function isDemoMode(): boolean {
  try {
    const { env } = getCloudflareContext();
    if ((env as unknown as Record<string, string | undefined>).DEMO_MODE === "1") return true;
  } catch {
    // Outside a request (build-time prerender) — fall through to process.env.
  }
  return process.env.DEMO_MODE === "1";
}
