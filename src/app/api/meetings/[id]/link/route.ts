/**
 * POST /api/meetings/[id]/link — link an inbox meeting to a deal (or account):
 *   { dealId? , organizationId? }
 * A held transcript graduates into deal_calls (extractor + readiness run).
 * Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { linkMeeting } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ dealId?: string; organizationId?: string }>(req);
    if (!body.dealId && !body.organizationId) throw new ApiError(400, "validation", "dealId or organizationId is required.");
    await linkMeeting(ctx, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
