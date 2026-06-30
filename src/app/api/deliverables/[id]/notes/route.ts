/**
 * POST /api/deliverables/:id/notes  { body }  — append a client-visible progress note.
 * Assigned Wahala staff only (admin / account owner / lead), once the stage is paid+.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { addDeliverableNote } from "@/services/deliverables";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ body?: string }>(req);
    if (!body.body?.trim()) throw new ApiError(400, "validation", "A note can't be empty.");
    await addDeliverableNote(ctx, id, body.body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
