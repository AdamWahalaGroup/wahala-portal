/**
 * GET  /api/deals/[id]/readiness — proposal-ready check (frame 39): score, failed
 *      package checks with verbatim transcript quotes, and the recommendation.
 * POST /api/deals/[id]/readiness — log a nudge outcome:
 *      { outcome: "fired" | "acted" | "overridden" }
 * Staff. Steps are never gates — this only informs and remembers.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { readinessCheck, recordNudgeOutcome } from "@/services/process";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const check = await readinessCheck(ctx, id);
    return NextResponse.json(check);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ outcome?: string; metadata?: unknown }>(req);
    if (body.outcome !== "fired" && body.outcome !== "acted" && body.outcome !== "overridden") {
      throw new ApiError(400, "validation", "outcome must be 'fired', 'acted', or 'overridden'.");
    }
    await recordNudgeOutcome(ctx, id, body.outcome, body.metadata);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
