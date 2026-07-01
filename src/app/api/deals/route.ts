/**
 * GET /api/deals — the sales overview: lead inbox + stage-grouped open pipeline
 * (staff only; scoped like the client list for non-admin staff).
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { salesOverview } from "@/services/sales";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const overview = await salesOverview(ctx);
    return NextResponse.json(overview);
  } catch (e) {
    return handleApiError(e);
  }
}
