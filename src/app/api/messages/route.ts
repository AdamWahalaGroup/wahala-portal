/**
 * POST /api/messages — post a message to a project thread (tenant-scoped).
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { postMessage, type WaitingOn } from "@/services/messages";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ projectId?: string; body?: string; waitingOn?: WaitingOn }>(req);
    if (!body.projectId) throw new ApiError(400, "validation", "projectId is required.");
    if (!body.body?.trim()) throw new ApiError(400, "validation", "A message can't be empty.");
    await postMessage(ctx, { projectId: body.projectId, body: body.body, waitingOn: body.waitingOn });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
