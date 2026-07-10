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
export async function seedDealPackage(organizationId: string | null, dealId: string): Promise<void> {
  const db = getDb();
  // Agreements are account-level docs — an account-less opportunity that reaches
  // Committed skips them until its account is born at Create project →. The deposit
  // below is deal-level and seeds regardless.
  if (organizationId) {
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
  }

  // The deposit is the package's blocking row — seed a sensible default (10% of the
  // deal, min $500) so no deal parks in Committed behind an unset amount. Staff can
  // still change it via the deposit API before marking it sent.
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (deal && deal.depositCents === 0 && !deal.depositPaidAt) {
    await db.update(schema.deals).set({ depositCents: defaultDepositCents(deal.valueCents) }).where(eq(schema.deals.id, dealId));
  }
}

/**
 * One-way sync: the contract/SOW DOCUMENT drives the deal's commercial/SOW
 * agreement ROW (founder call, 10 Jul — the two were parallel bookkeeping that
 * could disagree). Doc sent → row sent (only from needed); doc executed → row
 * signed. Never walks a row backwards. DocuSign webhooks replace this later.
 */
export async function syncCommercialRowFromContract(
  actorUserId: string,
  organizationId: string | null,
  dealId: string,
  docStatus: "sent" | "executed",
): Promise<void> {
  if (!organizationId) return;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.agreements)
    .where(and(eq(schema.agreements.organizationId, organizationId), eq(schema.agreements.dealId, dealId), eq(schema.agreements.kind, "commercial_agreement")));
  const row = rows.find((a) => a.status !== "n_a");
  if (!row) return;
  const next: AgreementStatus | null =
    docStatus === "executed" && row.status !== "signed" ? "signed" : docStatus === "sent" && row.status === "needed" ? "sent" : null;
  if (!next) return;
  await db.batch([
    db
      .update(schema.agreements)
      .set({ status: next, signedAt: next === "signed" ? row.signedAt ?? new Date() : row.signedAt })
      .where(eq(schema.agreements.id, row.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId,
        action: `agreement.${row.kind}_${next}`,
        entityType: "deal",
        entityId: dealId,
        metadata: { agreementId: row.id, kind: row.kind, label: row.label, via: "contract_doc" },
      }),
    ),
  ]);
}

/**
 * The NDA belongs at Discovery, not Committed (founder call, 10 Jul) — it exists to
 * protect the conversations about to happen. Idempotently seeds the account-level
 * NDA row for a working deal and returns it; null when the deal has no account yet
 * (account-less opportunity) or isn't in a working stage. `seedDealPackage` is
 * hasAccountKind-guarded, so a row seeded here is simply inherited at Committed.
 */
export async function ensureNdaForDeal(ctx: AuthContext, dealId: string): Promise<AgreementRow | null> {
  assertStaff(ctx, "ensure_nda");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal?.organizationId) return null;
  if (deal.stage === "new" || deal.stage === "lost") return null;
  const rows = await db
    .select()
    .from(schema.agreements)
    .where(and(eq(schema.agreements.organizationId, deal.organizationId), eq(schema.agreements.kind, "nda")));
  const existing = rows.find((a) => a.status === "signed") ?? rows.find((a) => a.status !== "n_a") ?? rows[0] ?? null;
  if (existing) return toRow(existing);
  const [inserted] = await db
    .insert(schema.agreements)
    .values({ organizationId: deal.organizationId, dealId, kind: "nda", label: LABELS.nda!, status: "needed" })
    .returning();
  return toRow(inserted);
}

export type AgreementDocView = {
  orgName: string;
  status: "none" | "needed" | "sent" | "signed";
  signedAt: Date | null;
  /** When the account's MSA was signed — the [MSA Date] merge field on docs that ride on it. */
  msaSignedAt: Date | null;
  wahalaRepName: string | null;
  clientRepName: string | null;
  clientRepTitle: string | null;
};

export type AgreementDocKind = "msa" | "nda" | "commercial_agreement" | "professional_services";

/**
 * Everything a boilerplate document page (MSA, NDA, Commercial Agreement, PS
 * Terms) needs: the account, its row of that kind (signed one preferred), and
 * the merge fields — Wahala rep = account owner, client rep = the account's
 * primary contact. Staff only.
 */
export async function agreementDocViewFor(
  ctx: AuthContext,
  organizationId: string,
  kind: AgreementDocKind,
): Promise<AgreementDocView | null> {
  assertStaff(ctx, `view_${kind}`);
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
  if (!org) return null;

  const all = await db.select().from(schema.agreements).where(eq(schema.agreements.organizationId, organizationId));
  const pick = (k: AgreementDocKind) => {
    const rows = all.filter((a) => a.kind === k);
    return rows.find((a) => a.status === "signed") ?? rows.find((a) => a.status !== "n_a") ?? null;
  };
  const doc = pick(kind);
  const msa = kind === "msa" ? doc : pick("msa");

  const [owner, contacts] = await Promise.all([
    org.accountOwnerUserId ? db.query.users.findFirst({ where: eq(schema.users.id, org.accountOwnerUserId) }) : null,
    db.select().from(schema.contacts).where(eq(schema.contacts.organizationId, organizationId)),
  ]);
  const primary = contacts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;

  return {
    orgName: org.name,
    status: doc ? (doc.status as "needed" | "sent" | "signed") : "none",
    signedAt: doc?.signedAt ?? null,
    msaSignedAt: msa?.status === "signed" ? msa.signedAt : null,
    wahalaRepName: owner?.name ?? null,
    clientRepName: primary?.name ?? null,
    clientRepTitle: primary?.title ?? null,
  };
}

/** The MSA document page's view (kept for existing callers). */
export async function msaViewFor(ctx: AuthContext, organizationId: string): Promise<AgreementDocView | null> {
  return agreementDocViewFor(ctx, organizationId, "msa");
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
