/**
 * POST /api/proposals/[id]/send — send the proposal: prices required, share token
 * generated, other open versions superseded, deal nudged to the proposal stage.
 * Complexity >3 is confirmed client-side; the server never hard-blocks (soft flag).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { sendProposal } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await sendProposal(ctx, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
