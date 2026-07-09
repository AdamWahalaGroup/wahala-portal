/**
 * GET  /api/contacts — every contact, lite (pickers + the Contacts page).
 * POST /api/contacts — "New contact + account" (HANDOFF-DELTA-2026-07-09 §3): a
 *   deliberate person(+company) record with NO opportunity. NO portal invite on
 *   create — the invite is a deliberate next step from the contact page.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { listContactsLite, createContactWithAccount } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const contacts = await listContactsLite(ctx);
    return NextResponse.json({ contacts });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      name?: string;
      email?: string;
      phone?: string;
      title?: string;
      organizationId?: string;
      newAccountName?: string;
      notes?: string;
      source?: string;
    }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "A contact needs at least a name.");
    const result = await createContactWithAccount(ctx, { ...body, name: body.name });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
