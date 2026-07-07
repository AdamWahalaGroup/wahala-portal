/** POST /api/proposals/[id]/contract/amendments { note } — log a change order (executed only). */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { addContractAmendment } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ note?: string }>(req);
    if (!body.note?.trim()) throw new ApiError(400, "validation", "Write the amendment first.");
    await addContractAmendment(ctx, id, body.note);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
