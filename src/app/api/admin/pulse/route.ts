/**
 * POST /api/admin/pulse — run the deal pulse ON DEMAND (admin only): the
 * deterministic tick + the AI pass. The cron does this on schedule; this route
 * exists for demos and local smoke tests ("run it now").
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { runPulseNow } from "@/services/pulse-admin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ctx = await requireAuth();
    const { tick, ai } = await runPulseNow(ctx);
    return NextResponse.json({ ok: true, tick, ai });
  } catch (e) {
    return handleApiError(e);
  }
}
