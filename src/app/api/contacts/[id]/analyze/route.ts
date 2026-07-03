/**
 * POST /api/contacts/[id]/analyze — run the AI scout: web recon + expert synthesis
 * over the contact's dump → opinion, 1–10 score, pursue/probe/pass.
 * Admin / account owner (it costs money). Replaces the previous analysis.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { analyzeContact } from "@/services/contact-workspace";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await analyzeContact(ctx, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
