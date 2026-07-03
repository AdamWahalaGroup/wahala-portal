/**
 * GET /api/deals/[id]/contract — the deal's agreement package + deposit state
 * (staff). Agreement status changes go through PATCH /api/agreements/[id].
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { getContractRoom } from "@/services/contract";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const room = await getContractRoom(ctx, id);
    return NextResponse.json(room);
  } catch (e) {
    return handleApiError(e);
  }
}
