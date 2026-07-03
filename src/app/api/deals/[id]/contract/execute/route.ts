/**
 * POST /api/deals/[id]/contract/execute — "Create project →" (frame 34): the AI
 * writes the SOW as a real project (phases + focus-area deliverables, no prices)
 * from the approved proposal's chosen option + discovery, links it to the deal, and
 * wins the deal. Gated on the deposit clearing; { force: true } lets an ADMIN
 * override. ~20–30s.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { executeContract } from "@/services/contract";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ force?: boolean }>(req);
    const result = await executeContract(ctx, id, { force: !!body.force });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
