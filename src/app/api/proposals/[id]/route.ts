/**
 * GET   /api/proposals/[id] — full proposal detail (staff)
 * PATCH /api/proposals/[id] — edit a DRAFT proposal (admin / account owner):
 *   { title?, executiveSummaryMd?, assumptionsMd?,
 *     option?: { id, name?, summaryMd?, timelineNote?, priceCents?, priceNote? } }
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { getProposal, updateProposal, updateProposalOption } from "@/services/proposals";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const proposal = await getProposal(ctx, id);
    return NextResponse.json({ proposal });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      title?: string;
      executiveSummaryMd?: string;
      assumptionsMd?: string;
      option?: { id: string; name?: string; summaryMd?: string; timelineNote?: string; priceCents?: number; priceNote?: string };
    }>(req);

    if (body.title !== undefined || body.executiveSummaryMd !== undefined || body.assumptionsMd !== undefined) {
      await updateProposal(ctx, id, {
        title: body.title,
        executiveSummaryMd: body.executiveSummaryMd,
        assumptionsMd: body.assumptionsMd,
      });
    }
    if (body.option?.id) {
      await updateProposalOption(ctx, id, body.option.id, {
        name: body.option.name,
        summaryMd: body.option.summaryMd,
        timelineNote: body.option.timelineNote,
        priceCents: body.option.priceCents,
        priceNote: body.option.priceNote,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
