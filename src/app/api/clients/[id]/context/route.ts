/**
 * POST /api/clients/[id]/context — set the per-client AI memory markdown
 * (organizations.ai_context_md). Wahala admin / Account Owner only.
 *
 * NOTE: the dynamic segment is `[id]` (the organization id) because the sibling
 * /api/clients/[id] route already claims that slot — Next.js disallows differing
 * dynamic-segment names at the same path level.
 */
import { NextResponse } from "next/server";
import { ApiError, handleApiError, readJson, requireAuth } from "@/lib/api";
import { setOrgAiContextMd } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ aiContextMd?: string }>(req);
    if (typeof body.aiContextMd !== "string") {
      throw new ApiError(400, "validation", "aiContextMd (string) is required.");
    }
    await setOrgAiContextMd(ctx, id, body.aiContextMd);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
