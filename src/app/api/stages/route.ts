/**
 * GET  /api/stages?projectId=...  — list a project's stages (tenant-scoped)
 * POST /api/stages                — create a draft stage with line items
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { scopedDb } from "@/db/scoped";
import { createStage } from "@/services/stages";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const projectId = new URL(req.url).searchParams.get("projectId");
    if (!projectId) throw new ApiError(400, "validation", "projectId query param is required.");
    const stages = await scopedDb(ctx).listStages(projectId);
    return NextResponse.json({ stages });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      projectId?: string;
      name?: string;
      scopeDescription?: string;
      totalAmountCents?: number;
      lineItems?: { description: string; estimateNote?: string }[];
    }>(req);

    if (!body.projectId || !body.name?.trim()) {
      throw new ApiError(400, "validation", "projectId and name are required.");
    }
    const total = body.totalAmountCents ?? 0;
    if (!Number.isInteger(total) || total < 0) {
      throw new ApiError(400, "validation", "totalAmountCents must be a non-negative integer.");
    }

    const stage = await createStage(ctx, {
      projectId: body.projectId,
      name: body.name.trim(),
      scopeDescription: body.scopeDescription,
      totalAmountCents: total,
      lineItems: body.lineItems,
    });
    return NextResponse.json({ stage }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
