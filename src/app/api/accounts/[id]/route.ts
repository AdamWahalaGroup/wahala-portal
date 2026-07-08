/**
 * DELETE /api/accounts/[id] — DEV TOOL: hard cascade-delete the account and
 * everything under it (deals, proposals, projects, contacts, users, audit…).
 * Admin only, irreversible. The UI's normal path is archive, not this.
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
