/**
 * GET    /api/proposals/[id] — full proposal detail (staff)
 * PATCH  /api/proposals/[id] — edit a DRAFT proposal (admin / account owner):
 *   { title?, executiveSummaryMd?, assumptionsMd?, complexityScore? }
 * DELETE /api/proposals/[id] — draft/sent only (admin / account owner)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { getProposal, updateProposal, deleteProposal } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const proposal = await getProposal(ctx, id);
    return NextResponse.json({ proposal });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ title?: string; executiveSummaryMd?: string; assumptionsMd?: string; complexityScore?: number }>(req);
    await updateProposal(ctx, id, {
      title: body.title,
      executiveSummaryMd: body.executiveSummaryMd,
      assumptionsMd: body.assumptionsMd,
      complexityScore: body.complexityScore,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteProposal(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
