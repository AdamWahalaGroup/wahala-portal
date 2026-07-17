import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { markProposalEvidenceReviewed } from "@/services/proposals";

export const dynamic = "force-dynamic";

/** Explicitly retain a manually reconciled draft against current discovery evidence. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await markProposalEvidenceReviewed(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
