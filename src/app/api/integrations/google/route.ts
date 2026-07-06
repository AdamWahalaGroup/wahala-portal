/**
 * Google Calendar disconnect lifecycle (frame 48 — guarded, undoable):
 *   DELETE                    — SOFT disconnect (sync stops; token kept for Undo)
 *   POST { action: "undo" }   — within the 30s window: restore, no re-auth
 *   POST { action: "revoke" } — after the window lapses: revoke at Google + delete
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { disconnect, undoDisconnect, revokeIfLapsed } from "@/services/integrations/google-calendar";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const ctx = await requireAuth();
    await disconnect(ctx);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ action?: string }>(req);
    if (body.action === "undo") {
      const restored = await undoDisconnect(ctx);
      return NextResponse.json({ ok: restored });
    }
    if (body.action === "revoke") {
      await revokeIfLapsed(ctx);
      return NextResponse.json({ ok: true });
    }
    throw new ApiError(400, "validation", "action must be 'undo' or 'revoke'.");
  } catch (e) {
    return handleApiError(e);
  }
}
