/**
 * PATCH /api/deals/[id] — move a deal between stages (free disposition)
 * and/or update its fields. `override: true` marks the move as a nudge override
 * (logged to process_events — steps are never gates). Admin / account owner only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { setDealStage, updateDeal, deleteDeal } from "@/services/sales";
import type {
  BudgetStatus,
  DataSensitivity,
  DeliveryModel,
  EngagementType,
  IpDisposition,
  NextActionCourt,
} from "@/domain/deal-operating-model";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{
      stage?: string;
      reason?: string;
      override?: boolean;
      name?: string;
      valueCents?: number;
      notes?: string;
      discoveryMd?: string;
      subStatus?: string | null;
      engagementType?: EngagementType | null;
      deliveryModel?: DeliveryModel | null;
      ipDisposition?: IpDisposition;
      dataSensitivity?: DataSensitivity;
      supportExpectation?: string | null;
      expectedCloseAt?: string | null;
      nextAction?: string | null;
      nextActionDueAt?: string | null;
      nextActionCourt?: NextActionCourt;
      champion?: string | null;
      economicBuyer?: string | null;
      compellingEvent?: string | null;
      decisionProcess?: string | null;
      budgetStatus?: BudgetStatus;
      budgetEvidence?: string | null;
    }>(req);

    const fields = {
      name: body.name,
      valueCents: body.valueCents,
      notes: body.notes,
      discoveryMd: body.discoveryMd,
      subStatus: body.subStatus,
      engagementType: body.engagementType,
      deliveryModel: body.deliveryModel,
      ipDisposition: body.ipDisposition,
      dataSensitivity: body.dataSensitivity,
      supportExpectation: body.supportExpectation,
      expectedCloseAt: body.expectedCloseAt,
      nextAction: body.nextAction,
      nextActionDueAt: body.nextActionDueAt,
      nextActionCourt: body.nextActionCourt,
      champion: body.champion,
      economicBuyer: body.economicBuyer,
      compellingEvent: body.compellingEvent,
      decisionProcess: body.decisionProcess,
      budgetStatus: body.budgetStatus,
      budgetEvidence: body.budgetEvidence,
    };
    if (Object.values(fields).some((value) => value !== undefined)) {
      await updateDeal(ctx, id, fields);
    }
    if (body.stage !== undefined) {
      await setDealStage(ctx, id, body.stage, body.reason, { override: !!body.override });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DEV TOOL — hard-delete the deal + everything under it (admin only). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    await deleteDeal(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
