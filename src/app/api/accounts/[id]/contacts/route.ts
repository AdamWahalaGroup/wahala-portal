/**
 * GET /api/accounts/[id]/contacts — the account's contacts with portal status
 * (none / invited / active / disabled). Feeds the invite modal (frame 35). Staff.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { listInvitableContacts } from "@/services/accounts";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const contacts = await listInvitableContacts(ctx, id);
    return NextResponse.json({ contacts });
  } catch (e) {
    return handleApiError(e);
  }
}
