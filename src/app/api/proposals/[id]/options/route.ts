/** POST /api/proposals/[id]/options — add an option (next letter A–H; draft only). */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { addProposalOption } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await addProposalOption(ctx, id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
