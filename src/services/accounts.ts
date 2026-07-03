/**
 * Accounts (frame 33 — "one thread"). An Account is the org record: "client" is a
 * STATE on it (prospect → client on first won deal → past client), not a separate
 * thing. This service assembles the Account page: header facts, ONE interleaved
 * sales+delivery timeline from the audit log, and the right rail (contacts, open
 * deals, projects, agreements). Builds on getAccountHub for the delivery-side reads.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { STAGE_META, isDealStage, type DealStage } from "@/domain/sales";
import { getAccountHub, type AccountHub } from "@/services/account-hub";
import { listForAccount, type AgreementRow } from "@/services/agreements";
import { assertSalesManager } from "@/services/sales";
import { buildAudit } from "@/services/audit";

export type AccountState = "prospect" | "client" | "past_client";

/** UI label mapping: the DB keeps prospect|active|archived; the UI says Client / Past client. */
export function accountState(orgStatus: string): AccountState {
  if (orgStatus === "active") return "client";
  if (orgStatus === "archived") return "past_client";
  return "prospect";
}

export type AccountTimelineItem = {
  /** Which domain colors the node: deal stages, project green, account cobalt, contact blue. */
  domain: "deal" | "project" | "account" | "contact";
  /** Bold lead-in ("Proposal WG-2026-001 sent") … */
  title: string;
  /** …then the rest of the sentence. */
  detail: string | null;
  /** Loop moment — renders the "↺ spawned the next deal" chip. */
  loop: boolean;
  at: Date;
};

export type AccountContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
};

export type AccountDeal = {
  id: string;
  name: string;
  stage: DealStage;
  stageLabel: string;
  valueCents: number;
  subStatus: string | null;
  depositDue: boolean;
  docsDone: number | null;
  docsTotal: number | null;
};

export type AccountView = {
  hub: AccountHub;
  state: AccountState;
  msaOnFile: boolean;
  wonDealCount: number;
  lifetimeWonCents: number;
  contacts: AccountContact[];
  openDeals: AccountDeal[];
  agreements: AgreementRow[];
  timeline: AccountTimelineItem[];
  /** Projects annotated with kind + whether their closeout should prompt the next deal. */
  projects: (AccountHub["projects"][number] & { kind: "standard" | "paid_discovery"; spawnedFromDealName: string | null })[];
};

const label = (s: string) => (isDealStage(s) ? STAGE_META[s as DealStage].label : s);

/** Map an audit row to a timeline item (null = not interesting on the account thread). */
function toTimelineItem(a: typeof schema.auditLog.$inferSelect, dealNames: Map<string, string>): AccountTimelineItem | null {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  const dealName = a.entityType === "deal" && a.entityId ? dealNames.get(a.entityId) ?? "Deal" : "Deal";
  const at = a.createdAt;
  switch (true) {
    case a.action === "deal.stage_changed": {
      const to = String(meta.to ?? "");
      return {
        domain: "deal",
        title: `${dealName} → ${label(to)}`,
        detail: meta.reason ? String(meta.reason) : meta.via ? `via ${String(meta.via)}` : null,
        loop: false,
        at,
      };
    }
    case a.action === "lead.qualified" || a.action === "contact.qualified":
      return { domain: "contact", title: `${String(meta.contactName ?? meta.leadName ?? "Contact")} qualified`, detail: `deal opened — ${String(meta.dealName ?? dealName)}`, loop: false, at };
    case a.action === "contact.bypassed_triage":
      return { domain: "contact", title: `${String(meta.contactName ?? "Contact")} captured`, detail: "bypassed triage → Discovery", loop: false, at };
    case a.action === "deal.created":
      return { domain: "deal", title: `${String(meta.dealName ?? dealName)} opened`, detail: meta.origin === "spawned_from_project" ? "spawned from project closeout" : null, loop: meta.origin === "spawned_from_project", at };
    case a.action === "proposal.sent":
      return { domain: "deal", title: `Proposal sent — ${dealName}`, detail: null, loop: false, at };
    case a.action === "proposal.approved":
      return { domain: "deal", title: `Proposal approved — ${dealName}`, detail: meta.respondedByName ? `by ${String(meta.respondedByName)}` : null, loop: false, at };
    case a.action === "deal.deposit_paid":
      return { domain: "deal", title: `Deposit cleared — ${dealName}`, detail: "project unlocked", loop: false, at };
    case a.action === "contract.executed":
      return { domain: "project", title: `${dealName} became a project`, detail: "phases drafted from the proposal", loop: true, at };
    case a.action.startsWith("agreement."): {
      const kind = String(meta.label ?? meta.kind ?? "Agreement");
      const status = a.action.split("_").pop();
      return status === "signed" ? { domain: "account", title: `${kind} signed`, detail: kind.toLowerCase().includes("master") ? "umbrella terms on file for all future work" : null, loop: false, at } : null;
    }
    case a.action === "stage.accepted" || a.action === "quote.approved" || a.action === "stage.paid":
      return { domain: "project", title: a.action === "stage.accepted" ? "Phase accepted" : a.action === "stage.paid" ? "Phase paid" : "Quote approved", detail: null, loop: false, at };
    default:
      return null;
  }
}

/** Everything the Account page renders. Throws NOT_FOUND when out of scope. */
export async function getAccountView(ctx: AuthContext, orgId: string): Promise<AccountView> {
  const hub = await getAccountHub(ctx, orgId); // does the staff + scope checks
  const db = getDb();

  const [dealRows, contactLinks, orgContacts, agreements, auditRows, projectKinds] = await Promise.all([
    db.select().from(schema.deals).where(eq(schema.deals.organizationId, orgId)).orderBy(desc(schema.deals.createdAt)),
    db.select().from(schema.contactCompanies).where(eq(schema.contactCompanies.organizationId, orgId)),
    db.select().from(schema.contacts).where(eq(schema.contacts.organizationId, orgId)),
    listForAccount(ctx, orgId),
    db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.organizationId, orgId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(200),
    db
      .select({ id: schema.projects.id, kind: schema.projects.kind })
      .from(schema.projects)
      .where(eq(schema.projects.organizationId, orgId)),
  ]);

  // Contacts: union of direct org link and the M2M table (dedupe by id).
  const linkContactIds = contactLinks.map((l) => l.contactId).filter((id) => !orgContacts.some((c) => c.id === id));
  const linkedContacts = linkContactIds.length
    ? await db.select().from(schema.contacts).where(inArray(schema.contacts.id, linkContactIds))
    : [];
  const primaryIds = new Set(contactLinks.filter((l) => l.isPrimary).map((l) => l.contactId));
  const primaryDealContact = dealRows.find((d) => d.primaryContactId)?.primaryContactId ?? null;
  const contacts: AccountContact[] = [...orgContacts, ...linkedContacts]
    .filter((c) => c.state !== "passed")
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      title: c.title,
      isPrimary: primaryIds.has(c.id) || c.id === primaryDealContact,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name));

  const msaOnFile = agreements.some((a) => a.kind === "msa" && a.status === "signed");

  // Open deals with committed-package progress for the rail's substatus line.
  const pkgByDeal = new Map<string, { done: number; total: number }>();
  const agRaw = await db.select().from(schema.agreements).where(eq(schema.agreements.organizationId, orgId));
  for (const a of agRaw) {
    if (!a.dealId || a.status === "n_a") continue;
    const p = pkgByDeal.get(a.dealId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (a.status === "signed") p.done += 1;
    pkgByDeal.set(a.dealId, p);
  }
  const openDeals: AccountDeal[] = dealRows
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .map((d) => {
      const pkg = pkgByDeal.get(d.id);
      const committed = d.stage === "committed";
      return {
        id: d.id,
        name: d.name,
        stage: d.stage,
        stageLabel: STAGE_META[d.stage].label,
        valueCents: d.valueCents,
        subStatus: d.subStatus,
        depositDue: committed && !d.depositPaidAt,
        docsDone: committed ? (pkg?.done ?? 0) + (d.depositPaidAt ? 1 : 0) : null,
        docsTotal: committed ? (pkg?.total ?? 0) + 1 : null,
      };
    });

  const wonDeals = dealRows.filter((d) => d.stage === "won");
  const dealNames = new Map(dealRows.map((d) => [d.id, d.name]));
  const timeline = auditRows
    .map((a) => toTimelineItem(a, dealNames))
    .filter((t): t is AccountTimelineItem => t !== null);

  const kindById = new Map(projectKinds.map((p) => [p.id, p.kind]));
  const spawnedByProject = new Map<string, string>(); // projectId → deal name
  for (const d of dealRows) if (d.projectId) spawnedByProject.set(d.projectId, d.name);

  return {
    hub,
    state: accountState(hub.org.status),
    msaOnFile,
    wonDealCount: wonDeals.length,
    lifetimeWonCents: wonDeals.reduce((n, d) => n + d.valueCents, 0),
    contacts,
    openDeals,
    agreements,
    timeline,
    projects: hub.projects.map((p) => ({
      ...p,
      kind: kindById.get(p.id) ?? "standard",
      spawnedFromDealName: spawnedByProject.get(p.id) ?? null,
    })),
  };
}

/**
 * "+ New deal" on the Account page (and the closeout "propose the next deal" CTA —
 * pass origin 'spawned_from_project'). Sales manager.
 */
export async function createDealOnAccount(
  ctx: AuthContext,
  orgId: string,
  input: { name: string; valueCents?: number; contactId?: string; origin?: "captured" | "spawned_from_project"; originProjectId?: string },
): Promise<{ dealId: string }> {
  assertSalesManager(ctx, "create_deal");
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Account not found.");
  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "A deal needs a name.");
  if (input.contactId) {
    const link = await db.query.contactCompanies.findFirst({
      where: and(eq(schema.contactCompanies.contactId, input.contactId), eq(schema.contactCompanies.organizationId, orgId)),
    });
    const direct = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, input.contactId) });
    if (!link && direct?.organizationId !== orgId) throw new StageError("VALIDATION", "That contact is not on this account.");
  }
  const dealId = crypto.randomUUID();
  const origin = input.origin ?? "captured";
  await db.batch([
    db.insert(schema.deals).values({
      id: dealId,
      organizationId: orgId,
      name,
      stage: "discovery",
      stageEnteredAt: new Date(),
      ownerUserId: ctx.user.id,
      primaryContactId: input.contactId ?? null,
      origin,
      valueCents: Math.max(0, Math.round(input.valueCents ?? 0)),
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: orgId,
        actorUserId: ctx.user.id,
        action: "deal.created",
        entityType: "deal",
        entityId: dealId,
        metadata: { dealName: name, origin, originProjectId: input.originProjectId ?? null },
      }),
    ),
  ]);
  return { dealId };
}
