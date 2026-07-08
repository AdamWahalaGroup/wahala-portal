/**
 * GET  /api/contacts — triage contacts (staff only)
 * POST /api/contacts — capture a contact (frame 32; any staff; a name is enough).
 *   With qualifyNow=true (the "Start deal → Discovery" bypass, sales manager) it also
 *   creates the deal on the chosen/inline-created account.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { listTriageContacts, captureContact } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const contacts = await listTriageContacts(ctx);
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
      organizationId?: string;
      newAccountName?: string;
      companyNote?: string;
      source?: string;
      estValueCents?: number;
      notes?: string;
      ownerUserId?: string;
      qualifyNow?: boolean;
      checks?: string[];
      skipTriage?: boolean;
    }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "A contact needs at least a name.");
    const result = await captureContact(ctx, { ...body, name: body.name });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
