/**
 * POST /api/deals/[id]/deposit — the Committed deposit (manual bookkeeping):
 *   { amountCents?: number, markSent?: boolean, markPaid?: boolean }
 * Paid unlocks "Create project →" (admins may force). Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { setDeposit } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ amountCents?: number; markSent?: boolean; markPaid?: boolean }>(req);
    await setDeposit(ctx, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
