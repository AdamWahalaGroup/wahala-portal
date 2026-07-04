/**
 * POST /api/accounts/[id]/invites — send portal invites to contacts (frame 35):
 *   { invites: [{ contactId, role: "client_admin"|"client_billing"|"client_readonly" }] }
 * Magic-link email per contact; skips contacts already on the portal or without an
 * email. Admin / account owner.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { invitePortalContacts, type PortalRole } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ invites?: { contactId?: string; role?: string }[] }>(req);
    const invites = (body.invites ?? [])
      .filter((i): i is { contactId: string; role?: string } => !!i.contactId)
      .map((i) => ({ contactId: i.contactId, role: (i.role ?? "client_admin") as PortalRole }));
    if (invites.length === 0) throw new ApiError(400, "validation", "Pick at least one contact to invite.");
    const result = await invitePortalContacts(ctx, id, invites, new URL(req.url).origin);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
