/**
 * POST /api/deals/[id]/meetings — schedule a call from the deal (frame 44):
 *   { title?, startsAt (ISO), durationMin?, contactIds?, sendInvite?, videoUrl? }
 * Creates a Google Calendar event on the scheduler's calendar (their connect is
 * required), auto-attaches a Zoom link when the company Zoom is connected (else
 * the pasted link / the loud no-video state), binds the meeting to this deal —
 * it becomes the deal's next step. Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { scheduleCall } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      title?: string;
      startsAt?: string;
      durationMin?: number;
      contactIds?: string[];
      sendInvite?: boolean;
      videoUrl?: string;
    }>(req);
    if (!body.startsAt) throw new ApiError(400, "validation", "startsAt (ISO datetime) is required.");
    const result = await scheduleCall(ctx, id, {
      title: body.title,
      startsAt: body.startsAt,
      durationMin: body.durationMin,
      contactIds: body.contactIds,
      sendInvite: body.sendInvite,
      videoUrl: body.videoUrl,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
