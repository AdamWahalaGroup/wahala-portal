/**
 * POST /api/meetings/[id]/suppress — "Not client work" (frame 45): removes the
 * inbox row and remembers the event so the matcher never resurfaces it. Staff.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { suppressMeeting } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await suppressMeeting(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
