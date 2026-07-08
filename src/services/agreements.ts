/**
 * Agreements — the agreement package (CRM-RESTRUCTURE.md, frame 34). Successor to
 * contract_items: MSA/NDA are ACCOUNT-level docs (deal_id kept only for provenance),
 * the commercial agreement / PS terms are per-deal. Once the account's MSA is signed,
 * later deals seed a SOW-only package — the fast lane ("MSA on file · SOW only").
 *
 * Statuses nudge, never gate: an incomplete package warns on Won, it doesn't block.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { defaultDepositCents } from "@/domain/proposal-math";
import { assertSalesManager, assertStaff } from "@/services/sales";
import { buildAudit } from "@/services/audit";

export type AgreementKind = (typeof schema.AGREEMENT_KINDS)[number];
export type AgreementStatus = (typeof schema.AGREEMENT_STATUSES)[number];

export type AgreementRow = {
  id: string;
  kind: AgreementKind;
  label: string;
  status: AgreementStatus;
  signedAt: Date | null;
  note: string | null;
  /** MSA/NDA count account-wide — signed once, reused by every later deal. */
  accountLevel: boolean;
};

const ACCOUNT_LEVEL_KINDS: readonly AgreementKind[] = ["msa", "nda"];

const toRow = (a: typeof schema.agreements.$inferSelect): AgreementRow => ({
  id: a.id,
  kind: a.kind,
  label: a.label,
  status: a.status,
  signedAt: a.signedAt,
  note: a.note,
  accountLevel: ACCOUNT_LEVEL_KINDS.includes(a.kind),
});

/** All agreements on an account (the Account page's right-rail list). */
export async function listForAccount(ctx: AuthContext, organizationId: string): Promise<AgreementRow[]> {
  assertStaff(ctx, "list_agreements");
  const db = getDb();
  const rows = await db.select().from(schema.agreements).where(eq(schema.agreements.organizationId, organizationId));
  // Account view: one row per kind for account-level docs (latest wins), all deal docs.
  return rows.map(toRow);
}

/**
 * The package a deal's drawer shows: this deal's docs + the account-level MSA/NDA
 * (whatever deal they were first signed under).
 */
export async function listForDeal(ctx: AuthContext, organizationId: string, dealId: string): Promise<{ rows: AgreementRow[]; msaOnFile: boolean }> {
  assertStaff(ctx, "list_agreements");
  const db = getDb();
  const all = await db.select().from(schema.agreements).where(eq(schema.agreements.organizationId, organizationId));
  const msaOnFile = all.some((a) => a.kind === "msa" && a.status === "signed");
  const seen = new Set<string>();
  const rows: AgreementRow[] = [];
  // Account-level docs first (deduped by kind, signed row preferred), then this deal's.
  for (const kind of ACCOUNT_LEVEL_KINDS) {
    const ofKind = all.filter((a) => a.kind === kind);
    if (ofKind.length === 0) continue;
    const pick = ofKind.find((a) => a.status === "signed") ?? ofKind[0];
    rows.push(toRow(pick));
    seen.add(pick.id);
  }
  for (const a of all) {
    if (a.dealId === dealId && !seen.has(a.id) && !ACCOUNT_LEVEL_KINDS.includes(a.kind)) rows.push(toRow(a));
  }
  return { rows, msaOnFile };
}

/** Mark an agreement sent / signed / n_a (sales manager). */
export async function setAgreementStatus(
  ctx: AuthContext,
  agreementId: string,
  input: { status: AgreementStatus; note?: string },
): Promise<void> {
  assertSalesManager(ctx, "set_agreement_status");
  if (!(schema.AGREEMENT_STATUSES as readonly string[]).includes(input.status)) {
    throw new StageError("VALIDATION", "Unknown agreement status.");
  }
  const db = getDb();
  const row = await db.query.agreements.findFirst({ where: eq(schema.agreements.id, agreementId) });
  if (!row) throw new StageError("NOT_FOUND", "Agreement not found.");
  const signedAt = input.status === "signed" ? row.signedAt ?? new Date() : null;
  await db.batch([
    db
      .update(schema.agreements)
      .set({ status: input.status, signedAt, note: input.note?.trim() || row.note })
      .where(eq(schema.agreements.id, agreementId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: row.organizationId,
        actorUserId: ctx.user.id,
        action: `agreement.${row.kind}_${input.status}`,
        entityType: row.dealId ? "deal" : "account",
        entityId: row.dealId ?? row.organizationId,
        metadata: { agreementId, kind: row.kind, label: row.label },
      }),
    ),
  ]);
}

const LABELS: Partial<Record<AgreementKind, string>> = {
  msa: "Master services agreement",
  nda: "Mutual NDA",
  commercial_agreement: "Commercial agreement",
  professional_services: "Professional services terms",
};

/**
 * Seed the package when a deal enters Committed (idempotent — safe to call on every
 * move). Account docs (MSA, NDA) are created once per account; with a signed MSA the
 * deal package is SOW-only (commercial agreement) — the fast lane.
 */
export async function seedDealPackage(organizationId: string, dealId: string): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(schema.agreements).where(eq(schema.agreements.organizationId, organizationId));
  const msaOnFile = existing.some((a) => a.kind === "msa" && a.status === "signed");
  const hasAccountKind = (k: AgreementKind) => existing.some((a) => a.kind === k);
  const hasDealKind = (k: AgreementKind) => existing.some((a) => a.dealId === dealId && a.kind === k);

  const values: (typeof schema.agreements.$inferInsert)[] = [];
  if (!hasAccountKind("msa")) values.push({ organizationId, dealId, kind: "msa", label: LABELS.msa!, status: "needed" });
  if (!hasAccountKind("nda")) values.push({ organizationId, dealId, kind: "nda", label: LABELS.nda!, status: "needed" });
  if (!hasDealKind("commercial_agreement")) {
    values.push({
      organizationId,
      dealId,
      kind: "commercial_agreement",
      label: msaOnFile ? "Statement of work" : LABELS.commercial_agreement!,
      status: "needed",
      note: msaOnFile ? "MSA on file — SOW only" : null,
    });
  }
  if (!msaOnFile && !hasDealKind("professional_services")) {
    values.push({ organizationId, dealId, kind: "professional_services", label: LABELS.professional_services!, status: "needed" });
  }
  if (values.length > 0) await db.insert(schema.agreements).values(values);

  // The deposit is the package's blocking row — seed a sensible default (10% of the
  // deal, min $500) so no deal parks in Committed behind an unset amount. Staff can
  // still change it via the deposit API before marking it sent.
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (deal && deal.depositCents === 0 && !deal.depositPaidAt) {
    await db.update(schema.deals).set({ depositCents: defaultDepositCents(deal.valueCents) }).where(eq(schema.deals.id, dealId));
  }
}

/** Package completeness for the Won-drag warning: pending docs by label. */
export async function pendingDocsForDeal(ctx: AuthContext, organizationId: string, dealId: string): Promise<string[]> {
  const { rows } = await listForDeal(ctx, organizationId, dealId);
  return rows.filter((r) => r.status !== "signed" && r.status !== "n_a").map((r) => r.label);
}

/** Used by account views: does this org have a signed MSA on file? */
export async function msaOnFileFor(organizationId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.agreements.id })
    .from(schema.agreements)
    .where(and(eq(schema.agreements.organizationId, organizationId), eq(schema.agreements.kind, "msa"), eq(schema.agreements.status, "signed")));
  return rows.length > 0;
}
