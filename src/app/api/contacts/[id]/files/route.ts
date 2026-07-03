/**
 * GET  /api/contacts/[id]/files — the contact's dump (staff)
 * POST /api/contacts/[id]/files — multipart upload, field "files" (any staff, ≤25 MB each)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, ApiError } from "@/lib/api";
import { listContactFiles, uploadContactFile } from "@/services/contact-workspace";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const files = await listContactFiles(ctx, id);
    return NextResponse.json({ files });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "validation", "Expected multipart form data.");
    const entries = form.getAll("files").filter((f): f is File => f instanceof File);
    if (entries.length === 0) throw new ApiError(400, "validation", "Attach at least one file.");

    const uploaded: string[] = [];
    for (const f of entries) {
      const { id: fileId } = await uploadContactFile(ctx, id, {
        fileName: f.name,
        mimeType: f.type || null,
        bytes: await f.arrayBuffer(),
      });
      uploaded.push(fileId);
    }
    return NextResponse.json({ ok: true, uploaded }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
