/**
 * Suggestion box (docs/AGENT-LAYER-DESIGN.md) — how agents talk to humans.
 * Agents insert (see services/pulse.ts); humans do or dismiss here.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
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

/** Suggestions for a deal (drawer card), newest first. Done ones stay visible
 *  (struck through, un-doable); only dismissed ones leave the list. */
export async function listSuggestionsForDeal(ctx: AuthContext, dealId: string): Promise<SuggestionRow[]> {
  assertStaff(ctx, "list_suggestions");
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.suggestions)
    .where(and(eq(schema.suggestions.dealId, dealId), inArray(schema.suggestions.status, ["open", "done"])))
    .orderBy(desc(schema.suggestions.createdAt));
  return rows.map((r) => ({ id: r.id, agentKey: r.agentKey, title: r.title, bodyMd: r.bodyMd, status: r.status, createdAt: r.createdAt }));
}

/** Mark a suggestion done or dismissed, or reopen a done one (any staff —
 *  acting on it is the point; reopen exists to recover from a mis-click or an
 *  admin overruling a "done"). */
export async function resolveSuggestion(ctx: AuthContext, id: string, status: "done" | "dismissed" | "open"): Promise<void> {
  assertStaff(ctx, "resolve_suggestion");
  const db = getDb();
  const row = await db.query.suggestions.findFirst({ where: eq(schema.suggestions.id, id) });
  if (!row) throw new StageError("NOT_FOUND", "Suggestion not found.");
  if (status === "open") {
    if (row.status !== "done") throw new StageError("INVALID_STATE", "Only a done suggestion can be reopened.");
    await db
      .update(schema.suggestions)
      .set({ status: "open", resolvedByUserId: null, resolvedAt: null })
      .where(eq(schema.suggestions.id, id));
    return;
  }
  if (row.status !== "open") throw new StageError("INVALID_STATE", "Already resolved.");
  await db
    .update(schema.suggestions)
    .set({ status, resolvedByUserId: ctx.user.id, resolvedAt: new Date() })
    .where(eq(schema.suggestions.id, id));
}
