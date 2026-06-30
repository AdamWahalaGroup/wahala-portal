/**
 * DELETE /api/tasks/:id — delete a task (admin / project lead), only while the stage
 * is still a draft (before the quote is sent).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { deleteTask } from "@/services/tasks";

export const dynamic = "force-dynamic";

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
