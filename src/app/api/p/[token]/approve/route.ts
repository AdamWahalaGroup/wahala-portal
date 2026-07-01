/**
 * POST /api/p/[token]/approve — PUBLIC: the prospect approves a sent proposal from
 * the share link. { optionId, name }. The unguessable token is the credential; the
 * typed name is the record. One shot — a responded proposal can't be re-approved.
 */
import { NextResponse } from "next/server";
import { handleApiError, readJson, ApiError } from "@/lib/api";
import { approveProposalByToken } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await readJson<{ optionId?: string; name?: string }>(req);
    if (!body.optionId || !body.name?.trim()) {
      throw new ApiError(400, "validation", "Pick an option and type your name to approve.");
    }
    await approveProposalByToken(token, { optionId: body.optionId, name: body.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
