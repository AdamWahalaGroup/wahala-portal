/**
 * DELETE /api/clients/:id — cascade-delete a client org + all its data (admin only).
 * For resetting test data; staff users (no org) are never affected.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { deleteOrganization } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteOrganization(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
