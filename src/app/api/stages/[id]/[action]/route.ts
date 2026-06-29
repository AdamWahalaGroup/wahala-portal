/**
 * POST /api/stages/:id/:action — drive a stage through its lifecycle.
 *
 * :action is any stage action (hyphens or underscores), e.g. send_quote,
 * approve_quote, mark_paid, start_work, deliver, accept, request_revision.
 * All authorization, state, and pay-gate checks live in the service.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { applyStageAction } from "@/services/stages";
import { ACTION_TRANSITION, type StageAction } from "@/domain/stage-machine";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id, action } = await params;

    const normalized = action.replace(/-/g, "_");
    if (!(normalized in ACTION_TRANSITION)) {
      throw new ApiError(400, "validation", `Unknown stage action "${action}".`);
    }

    const body = await readJson<{ stripeRef?: string; note?: string }>(req);
    const stage = await applyStageAction(ctx, id, normalized as StageAction, {
      stripeRef: body.stripeRef,
      note: body.note,
    });
    return NextResponse.json({ stage });
  } catch (e) {
    return handleApiError(e);
  }
}
