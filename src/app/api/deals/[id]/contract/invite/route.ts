/**
 * POST /api/deals/[id]/contract/invite — give the deal's primary contact a portal
 * account on the prospect org and send the magic-link invite (admin / account owner).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { inviteContactToOrg } from "@/services/contract";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await inviteContactToOrg(ctx, id, new URL(req.url).origin);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
