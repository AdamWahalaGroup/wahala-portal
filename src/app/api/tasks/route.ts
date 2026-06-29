/**
 * POST /api/tasks — create a task on a stage (admin / project lead).
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { createTask } from "@/services/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      stageId?: string;
      title?: string;
      description?: string;
      visibility?: string;
      assigneeUserId?: string;
    }>(req);

    if (!body.stageId || !body.title?.trim()) {
      throw new ApiError(400, "validation", "stageId and title are required.");
    }

    await createTask(ctx, {
      stageId: body.stageId,
      title: body.title,
      description: body.description,
      visibility: body.visibility,
      assigneeUserId: body.assigneeUserId || undefined,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
