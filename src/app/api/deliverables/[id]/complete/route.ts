/**
 * POST /api/deliverables/:id/complete  { completed }  — mark a deliverable done / not done.
 * Assigned Wahala staff only (admin / account owner / lead), once the stage is paid+.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { setDeliverableCompleted } from "@/services/deliverables";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ completed?: boolean }>(req);
    await setDeliverableCompleted(ctx, id, !!body.completed);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
