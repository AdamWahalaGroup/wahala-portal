/**
 * Subtasks on a task (admin / project lead):
 *   POST   /api/tasks/:id/subtasks   { title }            — add
 *   PATCH  /api/tasks/:id/subtasks   { subtaskId, done }  — toggle done
 *   DELETE /api/tasks/:id/subtasks   { subtaskId }        — remove
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { addSubtask, setSubtaskDone, removeSubtask } from "@/services/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ title?: string }>(req);
    if (!body.title?.trim()) throw new ApiError(400, "validation", "Subtask title is required.");
    await addSubtask(ctx, id, body.title);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ subtaskId?: string; done?: boolean }>(req);
    if (!body.subtaskId) throw new ApiError(400, "validation", "subtaskId is required.");
    await setSubtaskDone(ctx, id, body.subtaskId, !!body.done);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ subtaskId?: string }>(req);
    if (!body.subtaskId) throw new ApiError(400, "validation", "subtaskId is required.");
    await removeSubtask(ctx, id, body.subtaskId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
