/**
 * GET  /api/deals/[id]/proposals — versions for a deal (staff)
 * POST /api/deals/[id]/proposals — create a proposal (admin / account owner):
 *   { mode: "blank" } → two empty options, straight to the editor
 *   { mode: "rough", pathCount: "1"|"2"|"3", note?: string } → hybrid draft
 *     (deterministic shapes/prices + AI prose with deterministic fallback)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { listProposalsForDeal, createBlankProposal, roughDraftProposal } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const proposals = await listProposalsForDeal(ctx, id);
    return NextResponse.json({ proposals });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ mode?: string; pathCount?: string; note?: string }>(req);
    if (body.mode === "blank") {
      const result = await createBlankProposal(ctx, id);
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }
    if (body.mode === "rough") {
      if (!["1", "2", "3"].includes(body.pathCount ?? "")) throw new ApiError(400, "validation", "pathCount must be '1', '2', or '3'.");
      const result = await roughDraftProposal(ctx, id, { pathCount: body.pathCount as "1" | "2" | "3", note: body.note });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }
    throw new ApiError(400, "validation", "mode must be 'blank' or 'rough'.");
  } catch (e) {
    return handleApiError(e);
  }
}
