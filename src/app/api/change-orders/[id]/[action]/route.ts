/**
 * POST /api/change-orders/:id/:action — drive a change order through its lifecycle.
 * :action ∈ send_quote | approve | reject | mark_paid | apply | decline.
 * All authorization, state, and threshold checks live in the service.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { applyChangeAction, type ChangeAction } from "@/services/change-orders";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<ChangeAction>(["send_quote", "approve", "reject", "mark_paid", "apply", "decline"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, action } = await params;
    const normalized = action.replace(/-/g, "_") as ChangeAction;
    if (!ACTIONS.has(normalized)) {
      throw new ApiError(400, "validation", `Unknown change-order action "${action}".`);
    }
    const body = await readJson<{ totalAmountCents?: number; stripeRef?: string; note?: string; taskId?: string }>(req);
    const changeOrder = await applyChangeAction(ctx, id, normalized, {
      totalAmountCents: body.totalAmountCents,
      stripeRef: body.stripeRef,
      note: body.note,
      taskId: body.taskId,
    });
    return NextResponse.json({ changeOrder });
  } catch (e) {
    return handleApiError(e);
  }
}
