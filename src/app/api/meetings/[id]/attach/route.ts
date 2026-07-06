/**
 * POST /api/meetings/[id]/attach — attach an unmatched Zoom transcript to a deal:
 *   { dealId }
 * The held transcript graduates into deal_calls; the package extractor runs and
 * readiness updates. Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { attachMeetingToDeal } from "@/services/integrations/zoom";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ dealId?: string }>(req);
    if (!body.dealId) throw new ApiError(400, "validation", "dealId is required.");
    const result = await attachMeetingToDeal(ctx, id, body.dealId);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
