/**
 * POST /api/projects/ai-create — JSON body = the staffer-edited draft.
 * Composes createProject (+ ai_context_md) → createStage loop (no prices) → optional
 * postMessage to the account thread → appends the per-client AI memory. RBAC is
 * enforced by the inner createProject/createStage calls.
 */
import { NextResponse } from "next/server";
import { ApiError, handleApiError, readJson, requireAuth } from "@/lib/api";
import { createDraftedProject } from "@/services/projects";

export const dynamic = "force-dynamic";

type Body = {
  organizationId?: string;
  name?: string;
  description?: string;
  workType?: string;
  aiContextMd?: string;
  stages?: { name?: string; scopeDescription?: string; deliverables?: { epic?: string; description?: string }[] }[];
  clientMessage?: string;
  postToThread?: boolean;
};

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<Body>(req);

    const organizationId = body.organizationId?.trim();
    const name = body.name?.trim();
    if (!organizationId || !name) throw new ApiError(400, "validation", "organizationId and name are required.");
    if (!Array.isArray(body.stages) || body.stages.length === 0) {
      throw new ApiError(400, "validation", "At least one stage is required.");
    }

    const stages = body.stages.map((s, i) => {
      const sn = s.name?.trim();
      if (!sn) throw new ApiError(400, "validation", `Stage ${i + 1} needs a name.`);
      const deliverables = (s.deliverables ?? [])
        .map((d) => ({ epic: (d.epic ?? "").trim(), description: (d.description ?? "").trim() }))
        .filter((d) => d.description.length > 0);
      return { name: sn, scopeDescription: s.scopeDescription?.trim() || undefined, deliverables };
    });

    const { projectId } = await createDraftedProject(ctx, {
      organizationId,
      name,
      description: body.description?.trim() || undefined,
      workType: body.workType?.trim() || undefined,
      aiContextMd: body.aiContextMd,
      stages,
      clientMessage: body.clientMessage,
      postToThread: body.postToThread === true,
    });
    return NextResponse.json({ project: { id: projectId } }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
