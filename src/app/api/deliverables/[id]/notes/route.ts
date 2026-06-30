/**
 * Progress notes on a deliverable (assigned Wahala staff; stage paid+):
 *   POST   /api/deliverables/:id/notes  { body, visibility }            — add
 *   PATCH  /api/deliverables/:id/notes  { noteId, body, visibility }    — edit
 *   DELETE /api/deliverables/:id/notes  { noteId }                      — delete
 * visibility ∈ client_visible | internal.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { addDeliverableNote, editDeliverableNote, deleteDeliverableNote } from "@/services/deliverables";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ body?: string; visibility?: string }>(req);
    if (!body.body?.trim()) throw new ApiError(400, "validation", "A note can't be empty.");
    await addDeliverableNote(ctx, id, body.body, body.visibility);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ noteId?: string; body?: string; visibility?: string }>(req);
    if (!body.noteId) throw new ApiError(400, "validation", "noteId is required.");
    if (!body.body?.trim()) throw new ApiError(400, "validation", "A note can't be empty.");
    await editDeliverableNote(ctx, id, body.noteId, body.body, body.visibility);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ noteId?: string }>(req);
    if (!body.noteId) throw new ApiError(400, "validation", "noteId is required.");
    await deleteDeliverableNote(ctx, id, body.noteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
