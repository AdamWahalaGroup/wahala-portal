/** POST /api/p/[token]/decline { name?, note? } — the client declines via the share link. */
import { NextResponse } from "next/server";
import { handleApiError, readJson } from "@/lib/api";
import { declineProposalByToken } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await readJson<{ name?: string; note?: string }>(req);
    await declineProposalByToken(token, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
