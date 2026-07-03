/**
 * POST /api/accounts/[id]/deals — "+ New deal" on the Account page:
 *   { name, valueCents?, contactId?, origin?: "captured"|"spawned_from_project", originProjectId? }
 * Admin / account owner. Deals open at Discovery on this account.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { createDealOnAccount } from "@/services/accounts";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await readJson<{ name?: string; valueCents?: number; contactId?: string; origin?: "captured" | "spawned_from_project"; originProjectId?: string }>(req);
    if (!body.name?.trim()) throw new ApiError(400, "validation", "A deal needs a name.");
    const result = await createDealOnAccount(ctx, id, { ...body, name: body.name });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
