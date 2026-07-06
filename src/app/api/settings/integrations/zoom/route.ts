/**
 * POST /api/settings/integrations/zoom — the frame-47 "Connect Zoom" form:
 *   { accountId, clientId, clientSecret, secretToken?, hostEmail? }
 * Stores the Server-to-Server credentials in app_settings (connect is a settings
 * save, not a deploy). Admin only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { saveZoomCredentials } from "@/services/integrations/zoom";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{ accountId?: string; clientId?: string; clientSecret?: string; secretToken?: string; hostEmail?: string }>(req);
    await saveZoomCredentials(ctx, {
      accountId: body.accountId ?? "",
      clientId: body.clientId ?? "",
      clientSecret: body.clientSecret ?? "",
      secretToken: body.secretToken ?? "",
      hostEmail: body.hostEmail,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
