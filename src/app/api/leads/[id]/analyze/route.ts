/**
 * POST /api/leads/[id]/analyze — run the AI lead scout: web recon + expert
 * synthesis over the lead's dump → opinion, 1–10 score, pursue/probe/pass.
 * Admin / account owner (it costs money). Replaces the previous analysis.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { analyzeLead } from "@/services/lead-workspace";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await analyzeLead(ctx, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
