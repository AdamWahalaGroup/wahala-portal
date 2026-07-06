/**
 * POST /api/deals/[id]/meetings — schedule a Zoom call from the deal:
 *   { topic?, startsAt (ISO), durationMin?, inviteContact? }
 * Creates the Zoom meeting (cloud recording ON → transcript lands back on this
 * deal automatically), plus a Google Calendar event when the scheduler has
 * Calendar connected. Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { scheduleDealMeeting } from "@/services/integrations/zoom";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ topic?: string; startsAt?: string; durationMin?: number; inviteContact?: boolean }>(req);
    if (!body.startsAt) throw new ApiError(400, "validation", "startsAt (ISO datetime) is required.");
    const result = await scheduleDealMeeting(ctx, id, {
      topic: body.topic,
      startsAt: body.startsAt,
      durationMin: body.durationMin,
      inviteContact: body.inviteContact,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
