/**
 * GET /api/deals/[id]/calls/[callId] — the call transcript (staff). The package
 * card's provenance lines link here.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { getCallTranscript } from "@/services/process";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; callId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, callId } = await params;
    const call = await getCallTranscript(ctx, id, callId);
    return NextResponse.json(call);
  } catch (e) {
    return handleApiError(e);
  }
}
