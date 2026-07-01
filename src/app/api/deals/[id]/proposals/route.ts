/**
 * GET  /api/deals/[id]/proposals — versions for a deal (staff)
 * POST /api/deals/[id]/proposals — AI-draft the next version (admin / account owner)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { listProposalsForDeal, generateProposal } from "@/services/proposals";

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

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await generateProposal(ctx, id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
