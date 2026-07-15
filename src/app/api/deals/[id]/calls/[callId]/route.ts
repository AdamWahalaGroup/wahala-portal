/**
 * GET /api/deals/[id]/calls/[callId] — the call transcript (staff). The package
 * card's provenance lines link here.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { analyzeRecordedCall, applyCallReview, dismissCallReview, getCallReview, getCallTranscript } from "@/services/process";
import type { DiscoveryReviewSelection } from "@/domain/discovery-review";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, callId } = await params;
    const [call, review] = await Promise.all([getCallTranscript(ctx, id, callId), getCallReview(ctx, id, callId)]);
    return NextResponse.json({ ...call, review });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, callId } = await params;
    const body = await readJson<{ action?: string; selection?: DiscoveryReviewSelection }>(req);
    if (body.action === "analyze") {
      const result = await analyzeRecordedCall(ctx, id, callId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "dismiss") {
      await dismissCallReview(ctx, id, callId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "apply") {
      if (!body.selection) throw new ApiError(400, "validation", "A review selection is required.");
      const result = await applyCallReview(ctx, id, callId, body.selection);
      return NextResponse.json({ ok: true, ...result });
    }
    throw new ApiError(400, "validation", "Action must be analyze, apply, or dismiss.");
  } catch (e) {
    return handleApiError(e);
  }
}
