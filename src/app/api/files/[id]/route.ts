/**
 * GET    /api/files/:id — download a file (access + visibility checked; streams from R2)
 * DELETE /api/files/:id — delete a file (staff with project access)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { getAssetForDownload, deleteFile } from "@/services/files";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const { fileName, mimeType, object } = await getAssetForDownload(ctx, id);

    const headers = new Headers();
    headers.set("content-type", mimeType || object.httpMetadata?.contentType || "application/octet-stream");
    headers.set("content-disposition", `attachment; filename="${fileName.replace(/["\r\n]/g, "")}"`);
    if (typeof object.size === "number") headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteFile(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
