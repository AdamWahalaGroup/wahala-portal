/**
 * POST /api/deals/[id]/calls — save a recorded call (frame 38):
 *   { title, transcriptMd, recordedAt?, durationMin? }
 * Stores the transcript without invoking AI. Analysis is an explicit action on
 * the saved call, and no Deal evidence changes until its review is applied.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { saveRecordedCall } from "@/services/process";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ title?: string; transcriptMd?: string; recordedAt?: string; durationMin?: number }>(req);
    if (!body.title?.trim() || !body.transcriptMd?.trim()) {
      throw new ApiError(400, "validation", "title and transcriptMd are required.");
    }
    const result = await saveRecordedCall(ctx, id, {
      title: body.title,
      transcriptMd: body.transcriptMd,
      recordedAt: body.recordedAt,
      durationMin: body.durationMin,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
