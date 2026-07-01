/**
 * PATCH /api/leads/[id] — act on a lead (admin / account owner):
 *   { action: "qualify", organizationId?, dealName?, valueCents? } → org + contact + deal
 *   { action: "disqualify" }
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { qualifyLead, disqualifyLead } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      action?: string;
      organizationId?: string;
      dealName?: string;
      valueCents?: number;
    }>(req);

    if (body.action === "qualify") {
      const result = await qualifyLead(ctx, id, {
        organizationId: body.organizationId,
        dealName: body.dealName,
        valueCents: body.valueCents,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "disqualify") {
      await disqualifyLead(ctx, id);
      return NextResponse.json({ ok: true });
    }
    throw new ApiError(400, "validation", "action must be 'qualify' or 'disqualify'.");
  } catch (e) {
    return handleApiError(e);
  }
}
