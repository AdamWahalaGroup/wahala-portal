/**
 * POST /api/tasks/:id/status — update a task's status (admin / lead / assignee).
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { updateTaskStatus } from "@/services/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ status?: string }>(req);
    if (!body.status) throw new ApiError(400, "validation", "status is required.");
    await updateTaskStatus(ctx, id, body.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
