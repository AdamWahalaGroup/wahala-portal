/**
 * POST /api/deals/[id]/discovery — distill pasted transcript/notes into the deal's
 * Discovery Package (admin / account owner). Merges into any existing package.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { generateDiscovery } from "@/services/ai/discovery";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ pastedText?: string }>(req);
    if (!body.pastedText?.trim()) throw new ApiError(400, "validation", "Paste a transcript or notes to distill.");
    const result = await generateDiscovery(ctx, id, { pastedText: body.pastedText });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
