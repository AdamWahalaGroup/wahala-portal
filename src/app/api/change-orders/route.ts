/**
 * POST /api/change-orders — open a change request (client or staff) → a draft change order.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { requestChange } from "@/services/change-orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ projectId?: string; stageId?: string; name?: string; description?: string }>(req);
    if (!body.projectId || !body.name?.trim()) {
      throw new ApiError(400, "validation", "projectId and a short change title are required.");
    }
    const id = await requestChange(ctx, {
      projectId: body.projectId,
      stageId: body.stageId,
      name: body.name,
      description: body.description,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
