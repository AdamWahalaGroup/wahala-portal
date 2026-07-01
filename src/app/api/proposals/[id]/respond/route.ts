/**
 * POST /api/proposals/[id]/respond — staff records a response received outside the
 * app: { outcome: "approved"|"declined", optionId?, respondedByName?, responseNote? }.
 * Approval moves the deal to the contract stage.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { recordProposalResponse } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ outcome?: string; optionId?: string; respondedByName?: string; responseNote?: string }>(req);
    if (body.outcome !== "approved" && body.outcome !== "declined") {
      throw new ApiError(400, "validation", "outcome must be 'approved' or 'declined'.");
    }
    await recordProposalResponse(ctx, id, {
      outcome: body.outcome,
      optionId: body.optionId,
      respondedByName: body.respondedByName,
      responseNote: body.responseNote,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
