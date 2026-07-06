/**
 * POST /api/deals/[id]/discovery — distill pasted transcript/notes into the deal's
 * Discovery Package (admin / account owner). Merges into any existing package.
 * PATCH — manually set one package field (status/evidence); recomputes readiness.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { generateDiscovery } from "@/services/ai/discovery";
import { setPackageField } from "@/services/process";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ pastedText?: string }>(req);
    if (!body.pastedText?.trim()) throw new ApiError(400, "validation", "Paste a transcript or notes to distill.");
    const result = await generateDiscovery(ctx, id, { pastedText: body.pastedText });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ field?: string; status?: string; evidence?: string }>(req);
    if (!body.field || !body.status) throw new ApiError(400, "validation", "field and status are required.");
    const result = await setPackageField(ctx, id, body.field, { status: body.status, evidence: body.evidence });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
