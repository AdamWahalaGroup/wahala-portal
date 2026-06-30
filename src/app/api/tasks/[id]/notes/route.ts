/**
 * POST /api/tasks/:id/notes  { body }  — append a worklog note ("what was done").
 * Admin / project lead only.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { addNote } from "@/services/tasks";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ body?: string }>(req);
    if (!body.body?.trim()) throw new ApiError(400, "validation", "A note can't be empty.");
    await addNote(ctx, id, body.body);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
