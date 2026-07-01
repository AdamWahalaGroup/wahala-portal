/**
 * GET   /api/deals/[id]/contract — contract room state (staff)
 * PATCH /api/deals/[id]/contract — toggle a commercials item:
 *   { item: { kind: "msa"|"nda"|"insurance"|"other", status: "pending"|"signed", note? } }
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { getContractRoom, setContractItem } from "@/services/contract";

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ item?: { kind?: string; status?: string; note?: string } }>(req);
    if (!body.item?.kind || (body.item.status !== "pending" && body.item.status !== "signed")) {
      throw new ApiError(400, "validation", "item.kind and item.status ('pending'|'signed') are required.");
    }
    await setContractItem(ctx, id, { kind: body.item.kind, status: body.item.status, note: body.item.note });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
