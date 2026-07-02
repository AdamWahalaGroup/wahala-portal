/**
 * SLA & nudge settings persistence — a single app_settings row (key "sla") holding
 * the admin overrides as JSON. Effective settings = defaults ⊕ stored (resolveSla).
 * Read on the Board / Leads render; changed from /dashboard/settings/slas, live on the
 * next request with no redeploy.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { ApiError } from "@/lib/api";
import { resolveSla, type SlaSettings } from "@/domain/sla";

const SLA_KEY = "sla";

/** Effective SLA settings (defaults merged with any stored overrides). */
export async function getSlaSettings(): Promise<SlaSettings> {
  const row = await getDb().query.appSettings.findFirst({ where: eq(schema.appSettings.key, SLA_KEY) });
  return resolveSla(row?.value ?? null);
}

/** Persist SLA overrides (whole object; re-resolved so only valid fields land). Admin only. */
export async function saveSlaSettings(ctx: AuthContext, input: unknown): Promise<SlaSettings> {
  if (!ctx.isAdmin) throw new ApiError(403, "forbidden", "Wahala admin only.");
  const resolved = resolveSla(input);
  const db = getDb();
  const existing = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, SLA_KEY) });
  if (existing) {
    await db.update(schema.appSettings).set({ value: resolved, updatedByUserId: ctx.user.id }).where(eq(schema.appSettings.key, SLA_KEY));
  } else {
    await db.insert(schema.appSettings).values({ key: SLA_KEY, value: resolved, updatedByUserId: ctx.user.id });
  }
  return resolved;
}
