/**
 * PATCH /api/meetings/[id] — meeting edits (frames 42/43):
 *   { videoUrl }                  — paste-a-link on the no-video row (provider manual)
 *   { startsAt, durationMin? }    — Reschedule: patches the Google event, never recreates
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { setMeetingVideoUrl, rescheduleMeeting } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ videoUrl?: string; startsAt?: string; durationMin?: number }>(req);
    if (body.videoUrl !== undefined) {
      await setMeetingVideoUrl(ctx, id, body.videoUrl);
      return NextResponse.json({ ok: true });
    }
    if (body.startsAt) {
      await rescheduleMeeting(ctx, id, body.startsAt, body.durationMin);
      return NextResponse.json({ ok: true });
    }
    throw new ApiError(400, "validation", "Provide videoUrl or startsAt.");
  } catch (e) {
    return handleApiError(e);
  }
}
