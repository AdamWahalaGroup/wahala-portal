/**
 * PATCH /api/contacts/[id] — act on a contact:
 *   (no action)                — update the shared record (name/email/phone/title);
 *                                sales manager; edits propagate to every surface.
 *   { action: "assign", assignedToUserId } — handoff (any staff)
 *   { action: "update", name?, companyNote?, email?, phone?, source?, notes? }
 *                              — enrich the record (any staff)
 * Qualify/pass are RETIRED (HANDOFF-DELTA-2026-07-09) — the pipeline is deals;
 * start an opportunity via POST /api/opportunities instead.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { assignContact } from "@/services/sales";
import { deleteContact } from "@/services/clients";
import { updateContactFields } from "@/services/contact-workspace";
import { updateContact } from "@/services/contacts";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      action?: string;
      organizationId?: string;
      newAccountName?: string;
      dealName?: string;
      valueCents?: number;
      assignedToUserId?: string | null;
      name?: string;
      companyNote?: string;
      email?: string;
      phone?: string;
      title?: string;
      source?: string;
      notes?: string;
    }>(req);

    if (body.action === "assign") {
      await assignContact(ctx, id, body.assignedToUserId ?? null);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "update") {
      await updateContactFields(ctx, id, {
        name: body.name,
        companyNote: body.companyNote,
        email: body.email,
        phone: body.phone,
        source: body.source,
        notes: body.notes,
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === undefined) {
      await updateContact(ctx, id, { name: body.name, email: body.email, phone: body.phone, title: body.title });
      return NextResponse.json({ ok: true });
    }
    throw new ApiError(400, "validation", "action must be 'qualify', 'pass', 'assign', 'update', or omitted for a record edit.");
  } catch (e) {
    return handleApiError(e);
  }
}

/** DEV TOOL — hard-delete the contact (admin only; leads are contacts too). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteContact(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
