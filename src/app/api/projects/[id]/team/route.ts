/**
 * PUT /api/projects/[id]/team — assemble the delivery team (the handoff):
 *   { leadEngineerUserId: string|null, engineerIds: string[] }
 * Admin / account owner. Replaces the existing roster.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { setProjectTeam } from "@/services/handoff";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ leadEngineerUserId?: string | null; engineerIds?: string[] }>(req);
    await setProjectTeam(ctx, id, {
      leadEngineerUserId: body.leadEngineerUserId || null,
      engineerIds: Array.isArray(body.engineerIds) ? body.engineerIds.filter((v): v is string => typeof v === "string") : [],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
