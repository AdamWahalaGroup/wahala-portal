/**
 * POST /api/integrations/google/sync — "Sync now" (frame 47). Pulls the member's
 * calendar into the meetings table and stamps lastSyncAt. Staff.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { syncUserCalendar } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ctx = await requireAuth();
    const result = await syncUserCalendar(ctx);
    if (result === null) return NextResponse.json({ error: "not_connected", message: "Connect Google Calendar first." }, { status: 409 });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
