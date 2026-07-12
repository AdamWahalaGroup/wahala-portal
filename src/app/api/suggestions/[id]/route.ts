/** PATCH /api/suggestions/[id] { status: "done" | "dismissed" } — resolve a suggestion. */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { resolveSuggestion } from "@/services/suggestions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ status?: string }>(req);
    if (body.status !== "done" && body.status !== "dismissed") {
      throw new ApiError(400, "validation", "status must be 'done' or 'dismissed'.");
    }
    await resolveSuggestion(ctx, id, body.status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
