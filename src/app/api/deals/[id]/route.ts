/**
 * PATCH /api/deals/[id] — move a deal between stages (free disposition) and/or
 * update its fields. Admin / account owner only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { setDealStage, updateDeal } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ stage?: string; name?: string; valueCents?: number; notes?: string }>(req);

    if (body.name !== undefined || body.valueCents !== undefined || body.notes !== undefined) {
      await updateDeal(ctx, id, { name: body.name, valueCents: body.valueCents, notes: body.notes });
    }
    if (body.stage !== undefined) {
      await setDealStage(ctx, id, body.stage);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
