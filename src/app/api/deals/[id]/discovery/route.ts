/**
 * PATCH /api/deals/[id]/discovery — manually set one package field
 * (status/evidence); recomputes readiness. AI evidence uses the recorded-call
 * analyze/review path so it cannot silently bypass human review.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { setBuyingPathField, setPackageField } from "@/services/process";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ field?: string; status?: string; evidence?: string; area?: "discovery" | "buying_path"; budgetStatus?: string }>(req);
    if (!body.field || !body.status) throw new ApiError(400, "validation", "field and status are required.");
    const result = body.area === "buying_path"
      ? await setBuyingPathField(ctx, id, body.field, { status: body.status, evidence: body.evidence, budgetStatus: body.budgetStatus })
      : await setPackageField(ctx, id, body.field, { status: body.status, evidence: body.evidence });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
