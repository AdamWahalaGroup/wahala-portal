/**
 * GET  /api/projects        — list projects visible to the caller (tenant-scoped)
 * POST /api/projects        — create a project (Wahala admin / Account Owner)
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { scopedDb } from "@/db/scoped";
import { createProject } from "@/services/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const projects = await scopedDb(ctx).listProjects();
    return NextResponse.json({ projects });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      organizationId?: string;
      name?: string;
      description?: string;
      workType?: string;
      leadEngineerUserId?: string;
    }>(req);

    if (!body.organizationId || !body.name?.trim()) {
      throw new ApiError(400, "validation", "organizationId and name are required.");
    }

    const project = await createProject(ctx, {
      organizationId: body.organizationId,
      name: body.name.trim(),
      description: body.description,
      workType: body.workType,
      leadEngineerUserId: body.leadEngineerUserId,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
