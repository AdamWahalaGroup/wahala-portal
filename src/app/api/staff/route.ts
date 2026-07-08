/** GET /api/staff — active Wahala staff (id + name), for owner selects. Staff only. */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { listWahalaStaff } from "@/services/clients";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const staff = await listWahalaStaff(ctx);
    return NextResponse.json({ staff });
  } catch (e) {
    return handleApiError(e);
  }
}
