/**
 * GET /api/phases/:id — a single stage + its line items (tenant-scoped).
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError } from "@/lib/api";
import { scopedDb } from "@/db/scoped";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const sdb = scopedDb(ctx);
    const stage = await sdb.getStage(id);
    if (!stage) throw new ApiError(404, "not_found", "Phase not found.");
    const lineItems = await sdb.listStageLineItems(id);
    return NextResponse.json({ stage, lineItems });
  } catch (e) {
    return handleApiError(e);
  }
}
