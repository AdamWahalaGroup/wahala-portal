/**
 * GET  /api/clients  — list client orgs + contact + invite status (staff only)
 * POST /api/clients  — onboard a prospect and send an invite (admin only)
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { listClients, onboardClient } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    if (!ctx.isStaff) throw new ApiError(403, "forbidden", "Staff only.");
    const clients = await listClients(ctx);
    return NextResponse.json({ clients });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      organizationName?: string;
      contactName?: string;
      contactEmail?: string;
      intakeNotes?: string;
    }>(req);

    if (!body.organizationName?.trim() || !body.contactName?.trim() || !body.contactEmail?.trim()) {
      throw new ApiError(400, "validation", "Company, contact name, and contact email are required.");
    }

    const result = await onboardClient(
      ctx,
      {
        organizationName: body.organizationName,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        intakeNotes: body.intakeNotes,
      },
      new URL(req.url).origin,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
