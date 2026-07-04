/**
 * DELETE /api/clients/:id — ARCHIVE the account (frame 14b redesigned): soft —
 * hides it from active lists and revokes portal access; deletes nothing;
 * admin-restorable via PATCH { action: "restore" }. The old cascade delete lives on
 * in the service as a dev-only reset (deleteOrganization) — out of the product UI.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { archiveOrganization, restoreOrganization } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await archiveOrganization(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ action?: string }>(req);
    if (body.action !== "restore") throw new ApiError(400, "validation", "action must be 'restore'.");
    await restoreOrganization(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
