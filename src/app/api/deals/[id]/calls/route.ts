/**
 * POST /api/deals/[id]/calls — ingest a recorded call (frame 38):
 *   { title, transcriptMd, recordedAt?, durationMin? }
 * Stores the transcript, runs the package extractor (AI), merges the 10 Discovery
 * Package fields, recomputes readiness (snapshot logged to process_events).
 * Admin / account owner (it costs money). ~15–30s.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { ingestCall } from "@/services/process";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ title?: string; transcriptMd?: string; recordedAt?: string; durationMin?: number }>(req);
    if (!body.title?.trim() || !body.transcriptMd?.trim()) {
      throw new ApiError(400, "validation", "title and transcriptMd are required.");
    }
    const result = await ingestCall(ctx, id, {
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
