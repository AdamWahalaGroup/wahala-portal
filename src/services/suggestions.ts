/**
 * Suggestion box (docs/AGENT-LAYER-DESIGN.md) — how agents talk to humans.
 * Agents insert (see services/pulse.ts); humans do or dismiss here.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertStaff } from "@/services/sales";

export type SuggestionRow = {
  id: string;
  agentKey: string;
  title: string;
  bodyMd: string | null;
  status: (typeof schema.SUGGESTION_STATUSES)[number];
  createdAt: Date;
};

/** Open suggestions for a deal (drawer card), newest first. */
export async function listSuggestionsForDeal(ctx: AuthContext, dealId: string): Promise<SuggestionRow[]> {
  assertStaff(ctx, "list_suggestions");
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.suggestions)
    .where(and(eq(schema.suggestions.dealId, dealId), eq(schema.suggestions.status, "open")))
    .orderBy(desc(schema.suggestions.createdAt));
  return rows.map((r) => ({ id: r.id, agentKey: r.agentKey, title: r.title, bodyMd: r.bodyMd, status: r.status, createdAt: r.createdAt }));
}

/** Mark a suggestion done or dismissed (any staff — acting on it is the point). */
export async function resolveSuggestion(ctx: AuthContext, id: string, status: "done" | "dismissed"): Promise<void> {
  assertStaff(ctx, "resolve_suggestion");
  const db = getDb();
  const row = await db.query.suggestions.findFirst({ where: eq(schema.suggestions.id, id) });
  if (!row) throw new StageError("NOT_FOUND", "Suggestion not found.");
  if (row.status !== "open") throw new StageError("INVALID_STATE", "Already resolved.");
  await db
    .update(schema.suggestions)
    .set({ status, resolvedByUserId: ctx.user.id, resolvedAt: new Date() })
    .where(eq(schema.suggestions.id, id));
}
