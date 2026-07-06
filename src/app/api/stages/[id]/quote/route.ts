/**
 * PUT  /api/stages/:id/quote  — save the itemized draft quote (frame-06 builder)
 * POST /api/stages/:id/quote  — request a Wahala admin co-sign (over-threshold)
 *
 * Static `quote` segment wins over the dynamic `[action]` route, so this handles
 * the path; sending the quote still goes through POST /api/stages/:id/send_quote.
 * All authorization, draft-only, and total/threshold logic live in the service.
 */
import { NextResponse } from "next/server";
import { ApiError, requireAuth, handleApiError, readJson } from "@/lib/api";
import { saveQuoteDraft, requestQuoteCosign } from "@/services/stages";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      name?: string;
      scopeDescription?: string;
      totalAmountCents?: number;
      billingMode?: "upfront" | "on_delivery";
      lineItems?: { description?: string; estimateNote?: string; amountCents?: number; groupLabel?: string }[];
    }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "A stage name is required.");

    const stage = await saveQuoteDraft(ctx, id, {
      name: body.name,
      scopeDescription: body.scopeDescription,
      totalAmountCents: body.totalAmountCents,
      billingMode: body.billingMode,
      lineItems: (body.lineItems ?? []).map((li) => ({
        description: li.description ?? "",
        estimateNote: li.estimateNote,
        amountCents: Number(li.amountCents) || 0,
        groupLabel: li.groupLabel,
      })),
    });
    return NextResponse.json({ stage });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await requestQuoteCosign(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
