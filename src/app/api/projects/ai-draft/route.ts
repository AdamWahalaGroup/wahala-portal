/**
 * POST /api/projects/ai-draft — multipart (organizationId, files[], pastedText) →
 * { draft, usage }. Does NOT write to the DB; the staffer reviews & edits the draft
 * (design frame 20), then commits via /api/projects/ai-create.
 */
import { NextResponse } from "next/server";
import { ApiError, handleApiError, requireAuth } from "@/lib/api";
import { draftProject } from "@/services/ai/draft-project";
import { meterAiRun } from "@/services/pulse-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const form = await req.formData();
    const organizationId = String(form.get("organizationId") ?? "").trim();
    const pastedText = String(form.get("pastedText") ?? "");
    if (!organizationId) throw new ApiError(400, "validation", "organizationId is required.");

    const files: { name: string; mime: string; bytes: ArrayBuffer }[] = [];
    for (const entry of form.getAll("files")) {
      if (entry instanceof File) {
        files.push({ name: entry.name, mime: entry.type, bytes: await entry.arrayBuffer() });
      }
    }

    const result = await draftProject(ctx, { organizationId, files, pastedText });
    await meterAiRun({ agentKey: "project_draft", organizationId, ...result.usage });
    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
