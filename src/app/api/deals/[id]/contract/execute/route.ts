/**
 * POST /api/deals/[id]/contract/execute — the R4 seam: AI writes the SOW as a real
 * project (phases + focus-area deliverables, no prices) from the approved proposal's
 * chosen option + discovery, links it to the deal, and wins the deal. ~20–30s.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { executeContract } from "@/services/contract";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await executeContract(ctx, id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
