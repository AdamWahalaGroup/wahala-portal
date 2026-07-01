/**
 * GET  /api/leads — lead inbox (staff only)
 * POST /api/leads — capture a lead (any staff; a name is enough)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { listLeads, createLead } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const leads = await listLeads(ctx);
    return NextResponse.json({ leads });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      source?: string;
      industry?: string;
      notes?: string;
    }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "A lead needs at least a name.");
    const result = await createLead(ctx, { ...body, name: body.name });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
