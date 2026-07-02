/**
 * PATCH /api/contacts/[id] — update a shared contact (name/email/phone/title).
 * The edit propagates to every deal/lead/client surface that references it.
 * Sales manager only (assertSalesManager inside the service).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { updateContact } from "@/services/contacts";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ name?: string; email?: string; phone?: string; title?: string }>(req);
    await updateContact(ctx, id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
