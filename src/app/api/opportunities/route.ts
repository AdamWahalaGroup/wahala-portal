/**
 * POST /api/opportunities — start an opportunity (HANDOFF-DELTA-2026-07-09 §3):
 * a deal at stage 'new' on a contact (existing or created inline); the account is
 * optional. Any staff.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { createOpportunity } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      contactId?: string;
      contactName?: string;
      contactEmail?: string;
      organizationId?: string;
      newAccountName?: string;
      need?: string;
      estValueCents?: number;
      source?: string;
      ownerUserId?: string;
    }>(req);
    if (!body.contactId?.trim() && !body.contactName?.trim()) {
      throw new ApiError(400, "validation", "An opportunity needs a contact — pick one or give a name.");
    }
    const result = await createOpportunity(ctx, body);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
