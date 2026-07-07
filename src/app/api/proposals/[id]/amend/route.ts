/**
 * POST /api/proposals/[id]/amend { phaseIndex } — "Activate & amend": flip phase i
 * to active and i−1 to done, no new signature (approved + phased option only).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { amendPhase } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ phaseIndex?: number }>(req);
    const i = Number(body.phaseIndex);
    if (!Number.isInteger(i) || i < 0) throw new ApiError(400, "validation", "phaseIndex required.");
    await amendPhase(ctx, id, i);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
