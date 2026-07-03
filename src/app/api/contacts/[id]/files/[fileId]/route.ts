/**
 * GET    /api/contacts/[id]/files/[fileId] — download (staff)
 * DELETE /api/contacts/[id]/files/[fileId] — remove from the dump (admin / account owner)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { getContactFileBody, deleteContactFile } from "@/services/contact-workspace";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, fileId } = await params;
    const file = await getContactFileBody(ctx, id, fileId);
    return new Response(file.body, {
      headers: {
        "content-type": file.mimeType ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, fileId } = await params;
    await deleteContactFile(ctx, id, fileId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
