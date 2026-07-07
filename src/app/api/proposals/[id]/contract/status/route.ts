/** POST /api/proposals/[id]/contract/status { to } — draft→sent, sent→executed, sent→draft. */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { setContractStatus } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ to?: string }>(req);
    if (!["draft", "sent", "executed"].includes(body.to ?? "")) throw new ApiError(400, "validation", "to must be draft, sent, or executed.");
    await setContractStatus(ctx, id, body.to as "draft" | "sent" | "executed");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
