/**
 * GET  /api/notifications — this staff user's notifications + unread count.
 * PATCH /api/notifications — { ids?: string[] } marks those (or all unread) read.
 * Staff only (assertStaff inside the service).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { listForUser, markRead } from "@/services/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    return NextResponse.json(await listForUser(ctx));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ ids?: string[] }>(req);
    await markRead(ctx, body.ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
