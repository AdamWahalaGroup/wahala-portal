/**
 * PATCH /api/agreements/[id] — mark an agreement sent / signed / n_a:
 *   { status: "needed" | "sent" | "signed" | "n_a", note? }
 * Admin / account owner. Statuses nudge, never gate.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { setAgreementStatus, type AgreementStatus } from "@/services/agreements";

export const dynamic = "force-dynamic";

const STATUSES = ["needed", "sent", "signed", "n_a"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ status?: string; note?: string }>(req);
    if (!body.status || !(STATUSES as readonly string[]).includes(body.status)) {
      throw new ApiError(400, "validation", "status must be 'needed', 'sent', 'signed', or 'n_a'.");
    }
    await setAgreementStatus(ctx, id, { status: body.status as AgreementStatus, note: body.note });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
