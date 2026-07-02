/**
 * GET /api/settings/slas — effective SLA & nudge settings (defaults ⊕ stored).
 * PUT /api/settings/slas — replace the overrides with the posted settings object.
 * Wahala admin only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { getSlaSettings, saveSlaSettings } from "@/services/sla-settings";
import { DEFAULT_SLA_SETTINGS } from "@/domain/sla";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    if (!ctx.isAdmin) throw new ApiError(403, "forbidden", "Wahala admin only.");
    return NextResponse.json({ settings: await getSlaSettings(), defaults: DEFAULT_SLA_SETTINGS });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<unknown>(req);
    const settings = await saveSlaSettings(ctx, body);
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return handleApiError(e);
  }
}
