/**
 * POST /api/projects/[id]/closeout — dismiss the closeout → next-deal prompt
 * (frame 37, "Not now"). Logged; the prompt never comes back. Staff.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { dismissCloseoutPrompt } from "@/services/accounts";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await dismissCloseoutPrompt(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
