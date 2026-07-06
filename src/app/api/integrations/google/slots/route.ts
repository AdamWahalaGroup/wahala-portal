/**
 * GET /api/integrations/google/slots — 3 suggested times from the member's
 * free/busy (working hours in their calendar timezone). Frame 44's "When" chips.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { suggestSlots } from "@/services/integrations/google-calendar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const duration = Number(new URL(req.url).searchParams.get("duration") ?? "45");
    const slots = await suggestSlots(ctx.user.id, Number.isFinite(duration) && duration > 0 ? duration : 45);
    return NextResponse.json({ slots });
  } catch (e) {
    return handleApiError(e);
  }
}
