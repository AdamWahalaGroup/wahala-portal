/**
 * DELETE /api/integrations/google — disconnect Google Calendar (removes the
 * stored refresh token; revoke fully from the user's Google account settings).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { disconnect } from "@/services/integrations/google-calendar";

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
