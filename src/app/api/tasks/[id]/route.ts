/**
 * PATCH  /api/tasks/:id — update a task's visibility (admin / project lead).
 * DELETE /api/tasks/:id — delete a task (admin / project lead), any stage
 * status. DEV TOOL — hard delete while building; comes out with the other
 * delete affordances.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { deleteTask, setTaskVisibility } from "@/services/tasks";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { visibility?: string };
    await setTaskVisibility(ctx, id, body.visibility ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteTask(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
