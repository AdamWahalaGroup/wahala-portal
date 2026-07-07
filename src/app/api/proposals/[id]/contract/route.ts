/**
 * POST  /api/proposals/[id]/contract — generate the Contract/SOW snapshot (idempotent)
 * PATCH /api/proposals/[id]/contract — autosave edits (contract DRAFT only)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { generateContract, updateContract } from "@/services/proposals";
import type { ProposalContract } from "@/domain/proposal-doc";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const contract = await generateContract(ctx, id);
    return NextResponse.json({ ok: true, contract }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<Partial<ProposalContract>>(req);
    await updateContract(ctx, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
