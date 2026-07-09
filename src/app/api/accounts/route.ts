/**
 * POST /api/accounts — add a bare account (founder call, 09 Jul): name + owner +
 * optional intake notes + optional EXISTING contacts to attach. No invite goes
 * out — that's a deliberate step from each contact's page. Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { createAccount } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ name?: string; accountOwnerUserId?: string; intakeNotes?: string; contactIds?: string[] }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "An account needs a name.");
    const result = await createAccount(ctx, {
      name: body.name,
      accountOwnerUserId: body.accountOwnerUserId,
      intakeNotes: body.intakeNotes,
      contactIds: Array.isArray(body.contactIds) ? body.contactIds.filter((v): v is string => typeof v === "string") : [],
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
