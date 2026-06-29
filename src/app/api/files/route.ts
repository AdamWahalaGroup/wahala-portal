/**
 * POST /api/files — upload a file to a project (multipart; staff only).
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError } from "@/lib/api";
import { uploadFile } from "@/services/files";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const form = await req.formData();
    const projectId = String(form.get("projectId") ?? "");
    const visibility = String(form.get("visibility") ?? "client_visible");
    const file = form.get("file");
    if (!projectId || !(file instanceof File)) {
      throw new ApiError(400, "validation", "projectId and a file are required.");
    }
    await uploadFile(ctx, { projectId, file, visibility });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
