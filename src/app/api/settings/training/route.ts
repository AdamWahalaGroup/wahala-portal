/**
 * PATCH /api/settings/training — toggle training mode (frame 38):
 *   { on: boolean, userId?: string }
 * Self-toggleable by any staff; setting it for someone else is admin-only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { setTrainingMode } from "@/services/process";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ on?: boolean; userId?: string }>(req);
    if (typeof body.on !== "boolean") throw new ApiError(400, "validation", "on (boolean) is required.");
    await setTrainingMode(ctx, body.userId ?? ctx.user.id, body.on);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
