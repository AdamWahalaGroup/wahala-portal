/**
 * POST /api/phases/[id]/generate-tasks — AI-break this phase's SOW deliverables
 * into INTERNAL tasks (+subtasks). Admin or the project's lead engineer. Appends.
 * (Static segment — takes precedence over the [action] sibling.)
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api";
import { generateTasksForStage } from "@/services/handoff";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const result = await generateTasksForStage(ctx, id);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
