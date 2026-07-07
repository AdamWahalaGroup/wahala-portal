/**
 * PATCH  /api/proposals/[id]/options/[optionId] — edit option fields incl. phases
 *   (full-array replace), or { toggleRecommended: true } for the recommended toggle.
 * DELETE — remove the option (min 1 remains). Draft only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { updateProposalOption, setRecommendedOption, removeProposalOption } from "@/services/proposals";
import type { ProposalPhase } from "@/domain/proposal-doc";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, optionId } = await params;
    const body = await readJson<{
      toggleRecommended?: boolean;
      name?: string;
      summaryMd?: string;
      timelineNote?: string;
      priceCents?: number;
      priceNote?: string;
      phases?: ProposalPhase[] | null;
    }>(req);
    if (body.toggleRecommended) {
      await setRecommendedOption(ctx, id, optionId);
    } else {
      await updateProposalOption(ctx, id, optionId, {
        name: body.name,
        summaryMd: body.summaryMd,
        timelineNote: body.timelineNote,
        priceCents: body.priceCents,
        priceNote: body.priceNote,
        phases: body.phases,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id, optionId } = await params;
    await removeProposalOption(ctx, id, optionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
