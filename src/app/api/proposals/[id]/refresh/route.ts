import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { refreshProposalFromDiscovery } from "@/services/proposals";

export const dynamic = "force-dynamic";

/** Create a fresh AI-grounded draft version without overwriting the current draft. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await refreshProposalFromDiscovery(ctx, id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
