/**
 * Sales pipeline service (CRM front half, R1 — docs/brain_storming/synthesis.md).
 *
 * Leads are an UNOWNED trap: any staff member can capture one. Qualifying a lead
 * converts it into an organization (status 'prospect'), a contact (+ company link),
 * and a deal at 'discovery'. Deals move freely between stages — dispositions, not a
 * state machine — and every move is audited so the funnel history is reconstructable.
 * Winning a deal flips the org to 'active': the prospect became a customer, and the
 * existing contract→project seam takes over from there.
 *
 * RBAC: any staff can view and capture leads; qualifying, deal edits, and stage
 * moves need admin or account_owner (same tier as quoting).
 */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { isDealStage, daysInStage, FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";
import { isStuckWith, isLeadOverdue, type SlaSettings } from "@/domain/sla";
import { getSlaSettings } from "@/services/sla-settings";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

export function assertStaff(ctx: AuthContext, action: string): void {
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Wahala staff only.");
  }
}

export function assertSalesManager(ctx: AuthContext, action: string): void {
  assertStaff(ctx, action);
  if (!(ctx.isAdmin || ctx.user.role === "account_owner")) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_admin_or_owner" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or account owner can do that.");
  }
}

// ---------------------------------------------------------------- triage contacts
// "Lead" is a STATE on a contact (to_qualify), not a thing. The Triage column
// renders these rows; qualifying flips state and creates a deal referencing the
// SAME contact — nothing is converted, so an email edit anywhere lands everywhere.

export type ContactItem = {
  id: string;
  name: string;
  /** Free-text company until an account exists; the account name once linked. */
  companyNote: string | null;
  organizationId: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  state: "to_qualify" | "qualified" | "passed";
  estValueCents: number;
  assignedToUserId: string | null;
  assignedToName: string | null;
  aiScore: number | null;
  aiVerdict: "pursue" | "probe" | "pass" | null;
  /** The scout's full opinion (markdown), shown in the triage card drawer. */
  aiAnalysisMd: string | null;
  /** Still to_qualify past the triage SLA — flags ⚠ on its Triage card. */
  overdue: boolean;
  createdAt: Date;
};

export async function listTriageContacts(ctx: AuthContext): Promise<ContactItem[]> {
  assertStaff(ctx, "list_triage_contacts");
  const db = getDb();
  const [rows, sla] = await Promise.all([
    db.select().from(schema.contacts).where(eq(schema.contacts.state, "to_qualify")).orderBy(desc(schema.contacts.createdAt)),
    getSlaSettings(),
  ]);
  const now = new Date();
  const userIds = [...new Set(rows.map((c) => c.assignedToUserId).filter((v): v is string => !!v))];
  const orgIds = [...new Set(rows.map((c) => c.organizationId).filter((v): v is string => !!v))];
  const [staff, orgs] = await Promise.all([
    userIds.length > 0
      ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds))
      : Promise.resolve([]),
    orgIds.length > 0
      ? db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))
      : Promise.resolve([]),
  ]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const orgNames = new Map(orgs.map((o) => [o.id, o.name]));
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    companyNote: c.companyNote,
    organizationId: c.organizationId,
    organizationName: c.organizationId ? orgNames.get(c.organizationId) ?? null : null,
    email: c.email,
    phone: c.phone,
    source: c.source,
    notes: c.notes,
    state: c.state,
    estValueCents: c.estValueCents,
    assignedToUserId: c.assignedToUserId,
    assignedToName: c.assignedToUserId ? names.get(c.assignedToUserId) ?? null : null,
    aiScore: c.aiScore,
    aiVerdict: c.aiVerdict,
    aiAnalysisMd: c.aiAnalysisMd,
    overdue: isLeadOverdue(c.createdAt, now, sla),
    createdAt: c.createdAt,
  }));
}

/**
 * Hand a triage contact to a salesperson (or back to the unowned pool with null).
 * Any staff member can assign — claiming is a soft act, not a gate.
 */
export async function assignContact(ctx: AuthContext, contactId: string, userId: string | null): Promise<void> {
  assertStaff(ctx, "assign_contact");
  const db = getDb();
  if (userId) {
    const [target] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), eq(schema.users.userType, "wahala"), ne(schema.users.status, "disabled")));
    if (!target) throw new StageError("VALIDATION", "Contacts can only be assigned to active Wahala staff.");
  }
  const [row] = await db
    .update(schema.contacts)
    .set({ assignedToUserId: userId })
    .where(eq(schema.contacts.id, contactId))
    .returning({ id: schema.contacts.id });
  if (!row) throw new StageError("NOT_FOUND", "Contact not found.");
}

/**
 * Capture a contact (frame 32). Any staff can save to Triage. With qualifyNow
 * (the "Start deal → Discovery" bypass, ≥2 quick-check chips in the UI) it also
 * creates the deal — that needs the sales-manager tier, same as qualifying.
 * The account is optional for triage saves; the bypass requires one (existing id
 * or a new name created inline as a prospect).
 */
export async function captureContact(
  ctx: AuthContext,
  input: {
    name: string;
    email?: string;
    phone?: string;
    organizationId?: string;
    newAccountName?: string;
    source?: string;
    estValueCents?: number;
    notes?: string;
    qualifyNow?: boolean;
    /** Which quick-check chips were on — logged with the bypass, never a gate here. */
    checks?: string[];
    /** Account-page adds: a known person on an existing account — not a lead, no deal. */
    skipTriage?: boolean;
  },
): Promise<{ contactId: string; dealId?: string; organizationId?: string }> {
  assertStaff(ctx, "capture_contact");
  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "A contact needs at least a name.");
  const db = getDb();
  const now = new Date();
  const contactId = crypto.randomUUID();
  const statements = [];

  let organizationId = input.organizationId?.trim() || null;
  if (organizationId) {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
    if (!org) throw new StageError("VALIDATION", "That account does not exist.");
  } else if (input.newAccountName?.trim()) {
    organizationId = crypto.randomUUID();
    statements.push(
      db.insert(schema.organizations).values({
        id: organizationId,
        name: input.newAccountName.trim(),
        status: "prospect",
        accountOwnerUserId: ctx.user.id,
        ownerAssignedAt: now,
      }),
    );
  }

  const qualifyNow = !!input.qualifyNow;
  if (qualifyNow) {
    assertSalesManager(ctx, "capture_contact_bypass");
    if (!organizationId) throw new StageError("VALIDATION", "Starting a deal needs an account — pick one or create it inline.");
  }

  statements.push(
    db.insert(schema.contacts).values({
      id: contactId,
      organizationId,
      name,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      companyNote: input.newAccountName?.trim() || null,
      estValueCents: Math.max(0, Math.round(input.estValueCents ?? 0)),
      state: qualifyNow || (input.skipTriage && organizationId) ? "qualified" : "to_qualify",
      createdByUserId: ctx.user.id,
      assignedToUserId: qualifyNow ? ctx.user.id : null,
    }),
  );
  if (organizationId) {
    statements.push(db.insert(schema.contactCompanies).values({ contactId, organizationId, isPrimary: true }));
  }

  let dealId: string | undefined;
  if (qualifyNow && organizationId) {
    dealId = crypto.randomUUID();
    statements.push(
      db.insert(schema.deals).values({
        id: dealId,
        organizationId,
        name: `${input.newAccountName?.trim() || name} — opportunity`,
        stage: "discovery",
        stageEnteredAt: now,
        ownerUserId: ctx.user.id,
        primaryContactId: contactId,
        origin: "bypass",
        valueCents: Math.max(0, Math.round(input.estValueCents ?? 0)),
        notes: input.notes?.trim() || null,
      }),
      db.insert(schema.auditLog).values(
        buildAudit({
          organizationId,
          actorUserId: ctx.user.id,
          action: "contact.bypassed_triage",
          entityType: "deal",
          entityId: dealId,
          metadata: { contactId, contactName: name, checks: input.checks ?? [] },
        }),
      ),
    );
  }

  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { contactId, dealId, organizationId: organizationId ?? undefined };
}

/** Pass on a triage contact — kept and searchable, never deleted. */
export async function passContact(ctx: AuthContext, contactId: string): Promise<void> {
  assertSalesManager(ctx, "pass_contact");
  const db = getDb();
  const [row] = await db
    .update(schema.contacts)
    .set({ state: "passed" })
    .where(and(eq(schema.contacts.id, contactId), eq(schema.contacts.state, "to_qualify")))
    .returning({ id: schema.contacts.id });
  if (!row) throw new StageError("NOT_FOUND", "Triage contact not found.");
}

/**
 * Qualify a triage contact → deal at Discovery on an account (existing, the
 * contact's own, or a new prospect created from a name). The contact row is the
 * SAME record — state flips to qualified, nothing is copied or frozen.
 */
export async function qualifyContact(
  ctx: AuthContext,
  contactId: string,
  input: { organizationId?: string; newAccountName?: string; dealName?: string; valueCents?: number },
): Promise<{ dealId: string; organizationId: string; contactId: string }> {
  assertSalesManager(ctx, "qualify_contact");
  const db = getDb();
  const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
  if (!contact) throw new StageError("NOT_FOUND", "Contact not found.");
  if (contact.state !== "to_qualify") throw new StageError("INVALID_STATE", `Contact is already ${contact.state}.`);

  let organizationId = input.organizationId?.trim() || contact.organizationId || null;
  const now = new Date();
  const dealId = crypto.randomUUID();
  const newAccountName = input.newAccountName?.trim() || contact.companyNote?.trim() || null;
  const dealName = input.dealName?.trim() || `${newAccountName || contact.name} — opportunity`;
  const valueCents = Math.max(0, Math.round(input.valueCents ?? contact.estValueCents ?? 0));

  const statements = [];
  if (organizationId) {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
    if (!org) throw new StageError("VALIDATION", "That account does not exist.");
  } else {
    if (!newAccountName) {
      throw new StageError("VALIDATION", "Add an account (pick one or give a company name) before qualifying.");
    }
    organizationId = crypto.randomUUID();
    statements.push(
      db.insert(schema.organizations).values({
        id: organizationId,
        name: newAccountName,
        status: "prospect",
        accountOwnerUserId: ctx.user.id,
        ownerAssignedAt: now,
      }),
    );
  }

  const existingLink = await db.query.contactCompanies.findFirst({
    where: and(eq(schema.contactCompanies.contactId, contactId), eq(schema.contactCompanies.organizationId, organizationId)),
  });

  statements.push(
    db
      .update(schema.contacts)
      .set({ state: "qualified", organizationId, assignedToUserId: contact.assignedToUserId ?? ctx.user.id })
      .where(eq(schema.contacts.id, contactId)),
    db.insert(schema.deals).values({
      id: dealId,
      organizationId,
      name: dealName,
      stage: "discovery",
      stageEnteredAt: now,
      ownerUserId: ctx.user.id,
      primaryContactId: contactId,
      origin: "qualified_from_triage",
      valueCents,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId: ctx.user.id,
        action: "contact.qualified",
        entityType: "deal",
        entityId: dealId,
        metadata: { contactId, contactName: contact.name, dealName },
      }),
    ),
  );
  if (!existingLink) {
    statements.push(db.insert(schema.contactCompanies).values({ contactId, organizationId, isPrimary: true }));
  }

  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { dealId, organizationId, contactId };
}

// ---------------------------------------------------------------- deals

export type DealItem = {
  id: string;
  name: string;
  stage: DealStage;
  organizationId: string;
  organizationName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  contactName: string | null;
  valueCents: number;
  daysInStage: number;
  stuck: boolean;
  stageEnteredAt: Date;
  notes: string | null;
  /** One-line next step for this stage (board card peek). */
  nextStep: string;
  /** Scout opinion carried on the (shared) contact record. */
  scoutMd: string | null;
  scoutScore: number | null;
  scoutVerdict: "pursue" | "probe" | "pass" | null;
  origin: "captured" | "qualified_from_triage" | "bypass" | "spawned_from_project";
  /** Negotiating substatus chip ("redlines with counsel", "verbal yes · terms open"). */
  subStatus: string | null;
  /** Days since the latest SENT proposal (proposal_out clock), or null. */
  sentDaysAgo: number | null;
  /** Proposal-out card past the follow-up SLA — the at-risk clock. */
  proposalSilent: boolean;
  /** Committed package progress (deposit counts as a doc when set). */
  docsDone: number | null;
  docsTotal: number | null;
  depositDue: boolean;
  /** The account has a signed MSA — this deal is on the SOW-only fast lane. */
  msaOnFile: boolean;
  /** Chip: born from / running as paid discovery. */
  paidDiscovery: boolean;
  /** Proposal-readiness snapshot (0–10) — drives the frame-39 nudge on advance. */
  readinessScore: number | null;
};

async function loadDealItems(ctx: AuthContext, sla: SlaSettings): Promise<DealItem[]> {
  const db = getDb();
  let rows = await db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt));
  // Non-admin staff see deals only for orgs in their access scope, matching listClients.
  const scope = ctx.accessScope;
  if (scope.kind !== "all") rows = rows.filter((d) => scope.orgIds.includes(d.organizationId));
  if (rows.length === 0) return [];

  const orgIds = [...new Set(rows.map((d) => d.organizationId))];
  const userIds = [...new Set(rows.map((d) => d.ownerUserId).filter((v): v is string => !!v))];
  const contactIds = [...new Set(rows.map((d) => d.primaryContactId).filter((v): v is string => !!v))];
  const dealIds = rows.map((d) => d.id);
  const projectIds = [...new Set(rows.map((d) => d.projectId).filter((v): v is string => !!v))];

  const [orgs, owners, people, sentProposals, agRows, projects] = await Promise.all([
    db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds)),
    userIds.length > 0
      ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds))
      : Promise.resolve([]),
    contactIds.length > 0
      ? db
          .select({ id: schema.contacts.id, name: schema.contacts.name, aiAnalysisMd: schema.contacts.aiAnalysisMd, aiScore: schema.contacts.aiScore, aiVerdict: schema.contacts.aiVerdict })
          .from(schema.contacts)
          .where(inArray(schema.contacts.id, contactIds))
      : Promise.resolve([]),
    db
      .select({ dealId: schema.proposals.dealId, sentAt: schema.proposals.sentAt })
      .from(schema.proposals)
      .where(and(inArray(schema.proposals.dealId, dealIds), eq(schema.proposals.status, "sent"))),
    db
      .select({ organizationId: schema.agreements.organizationId, dealId: schema.agreements.dealId, kind: schema.agreements.kind, status: schema.agreements.status })
      .from(schema.agreements)
      .where(inArray(schema.agreements.organizationId, orgIds)),
    projectIds.length > 0
      ? db.select({ id: schema.projects.id, kind: schema.projects.kind }).from(schema.projects).where(inArray(schema.projects.id, projectIds))
      : Promise.resolve([]),
  ]);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const ownerName = new Map(owners.map((u) => [u.id, u.name]));
  const contactById = new Map(people.map((c) => [c.id, c]));
  const projectKind = new Map(projects.map((p) => [p.id, p.kind]));
  const latestSent = new Map<string, Date>();
  for (const p of sentProposals) {
    if (!p.sentAt) continue;
    const cur = latestSent.get(p.dealId);
    if (!cur || p.sentAt > cur) latestSent.set(p.dealId, p.sentAt);
  }
  // MSA on file per org (account-level fast lane) + per-deal package progress.
  const msaOrgs = new Set(agRows.filter((a) => a.kind === "msa" && a.status === "signed").map((a) => a.organizationId));
  const pkgByDeal = new Map<string, { done: number; total: number }>();
  for (const a of agRows) {
    if (!a.dealId || a.status === "n_a") continue;
    const p = pkgByDeal.get(a.dealId) ?? { done: 0, total: 0 };
    p.total += 1;
    if (a.status === "signed") p.done += 1;
    pkgByDeal.set(a.dealId, p);
  }

  const now = new Date();
  return rows.map((d) => {
    const contact = d.primaryContactId ? contactById.get(d.primaryContactId) : undefined;
    const sentAt = latestSent.get(d.id) ?? null;
    const sentDaysAgo = sentAt ? daysInStage(sentAt, now) : null;
    // Deposit is part of the committed package: one more doc, done when paid.
    const pkg = pkgByDeal.get(d.id);
    const withDeposit = d.depositCents > 0 || d.stage === "committed";
    const docsTotal = d.stage === "committed" ? (pkg?.total ?? 0) + (withDeposit ? 1 : 0) : null;
    const docsDone = d.stage === "committed" ? (pkg?.done ?? 0) + (withDeposit && d.depositPaidAt ? 1 : 0) : null;
    return {
      id: d.id,
      name: d.name,
      stage: d.stage,
      organizationId: d.organizationId,
      organizationName: orgName.get(d.organizationId) ?? "Unknown",
      ownerUserId: d.ownerUserId,
      ownerName: d.ownerUserId ? ownerName.get(d.ownerUserId) ?? null : null,
      contactName: contact?.name ?? null,
      valueCents: d.valueCents,
      daysInStage: daysInStage(d.stageEnteredAt, now),
      stuck: isStuckWith(d.stage, d.stageEnteredAt, now, sla),
      stageEnteredAt: d.stageEnteredAt,
      notes: d.notes,
      nextStep: nextStepFor(d.stage),
      scoutMd: contact?.aiAnalysisMd ?? null,
      scoutScore: contact?.aiScore ?? null,
      scoutVerdict: contact?.aiVerdict ?? null,
      origin: d.origin,
      subStatus: d.subStatus,
      sentDaysAgo,
      proposalSilent: d.stage === "proposal_out" && (sentDaysAgo ?? daysInStage(d.stageEnteredAt, now)) >= sla.proposalFollowupDays,
      docsDone,
      docsTotal,
      depositDue: d.stage === "committed" && !d.depositPaidAt,
      msaOnFile: msaOrgs.has(d.organizationId),
      paidDiscovery: d.origin === "spawned_from_project" || (d.projectId ? projectKind.get(d.projectId) === "paid_discovery" : false),
      readinessScore: d.readinessScore,
    };
  });
}

/**
 * Move a deal to any stage — dispositions, no transition rules. Records the move
 * in the audit log and resets the days-in-stage clock. Winning flips the org to
 * 'active' (prospect became customer).
 */
export async function setDealStage(
  ctx: AuthContext,
  dealId: string,
  stage: string,
  reason?: string,
  opts: { override?: boolean } = {},
): Promise<void> {
  assertSalesManager(ctx, "set_deal_stage");
  if (!isDealStage(stage)) throw new StageError("VALIDATION", "Unknown sales stage.");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  if (deal.stage === stage) return;

  // Stage moves clear the substatus chip — it describes the stage the deal was in.
  const moveDeal = db.update(schema.deals).set({ stage, stageEnteredAt: new Date(), subStatus: null }).where(eq(schema.deals.id, dealId));
  const audit = db.insert(schema.auditLog).values(
    buildAudit({
      organizationId: deal.organizationId,
      actorUserId: ctx.user.id,
      action: "deal.stage_changed",
      entityType: "deal",
      entityId: dealId,
      metadata: reason?.trim() ? { from: deal.stage, to: stage, reason: reason.trim() } : { from: deal.stage, to: stage },
    }),
  );
  if (stage === "won") {
    // The prospect became a customer — the contract→project seam takes over from here.
    // The Discovery Package graduates into the client's durable AI memory so every
    // later AI feature (project drafts, proposals) is grounded in what sales learned.
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) });
    let aiContextMd = org?.aiContextMd ?? null;
    if (deal.discoveryMd?.trim() && !(aiContextMd ?? "").includes(deal.discoveryMd.trim())) {
      const block = `## Discovery — ${deal.name} (won ${new Date().toLocaleDateString("en-US")})\n\n${deal.discoveryMd.trim()}`;
      aiContextMd = aiContextMd ? `${aiContextMd}\n\n${block}` : block;
    }
    const activateOrg = db
      .update(schema.organizations)
      .set({ status: "active", aiContextMd })
      .where(eq(schema.organizations.id, deal.organizationId));
    await db.batch([moveDeal, audit, activateOrg]);
  } else {
    await db.batch([moveDeal, audit]);
  }
  if (stage === "committed") {
    // Entering Committed seeds the agreement package (idempotent) so the drawer's
    // checklist and the card's docs-N/M chip have rows to read.
    const { seedDealPackage } = await import("@/services/agreements");
    await seedDealPackage(deal.organizationId, dealId);
  }

  // Process model (TRAINING-AND-SCORECARD.md): every move logs an append-only
  // event with a readiness SNAPSHOT; an overridden nudge logs alongside it; Lost
  // auto-generates the post-mortem. Guidance never blocks — it only remembers.
  const { recordProcessEvent, generatePostMortem } = await import("@/services/process");
  await recordProcessEvent({
    organizationId: deal.organizationId,
    dealId,
    ownerUserId: deal.ownerUserId,
    actorUserId: ctx.user.id,
    kind: "stage_moved",
    fromStep: deal.stage,
    toStep: stage,
    readinessScore: deal.readinessScore,
    metadata: reason?.trim() ? { reason: reason.trim() } : null,
  });
  if (opts.override) {
    await recordProcessEvent({
      organizationId: deal.organizationId,
      dealId,
      ownerUserId: deal.ownerUserId,
      actorUserId: ctx.user.id,
      kind: "nudge_overridden",
      fromStep: deal.stage,
      toStep: stage,
      readinessScore: deal.readinessScore,
      metadata: { via: "advance_anyway" },
    });
  }
  if (stage === "lost") {
    await generatePostMortem(dealId, ctx.user.id, reason ?? null);
  }
}

export async function updateDeal(
  ctx: AuthContext,
  dealId: string,
  input: { name?: string; valueCents?: number; notes?: string; discoveryMd?: string; subStatus?: string | null },
): Promise<void> {
  assertSalesManager(ctx, "update_deal");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const patch: Partial<typeof schema.deals.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new StageError("VALIDATION", "Deal name cannot be empty.");
    patch.name = name;
  }
  if (input.valueCents !== undefined) patch.valueCents = Math.max(0, Math.round(input.valueCents));
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (input.discoveryMd !== undefined) patch.discoveryMd = input.discoveryMd.trim() || null;
  if (input.subStatus !== undefined) patch.subStatus = input.subStatus?.trim() || null;
  if (Object.keys(patch).length === 0) return;
  await db.update(schema.deals).set(patch).where(eq(schema.deals.id, dealId));
}

/**
 * The Committed deposit — manual bookkeeping (no PSP): set the amount, mark the
 * invoice sent, mark it paid. Paid unlocks Create project (admins may force).
 */
export async function setDeposit(
  ctx: AuthContext,
  dealId: string,
  input: { amountCents?: number; markSent?: boolean; markPaid?: boolean },
): Promise<void> {
  assertSalesManager(ctx, "set_deposit");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const patch: Partial<typeof schema.deals.$inferInsert> = {};
  if (input.amountCents !== undefined) patch.depositCents = Math.max(0, Math.round(input.amountCents));
  const now = new Date();
  if (input.markSent) patch.depositSentAt = deal.depositSentAt ?? now;
  if (input.markPaid) {
    patch.depositPaidAt = deal.depositPaidAt ?? now;
    patch.depositSentAt = deal.depositSentAt ?? now;
  }
  if (Object.keys(patch).length === 0) return;
  await db.batch([
    db.update(schema.deals).set(patch).where(eq(schema.deals.id, dealId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: input.markPaid ? "deal.deposit_paid" : input.markSent ? "deal.deposit_sent" : "deal.deposit_updated",
        entityType: "deal",
        entityId: dealId,
        metadata: { amountCents: patch.depositCents ?? deal.depositCents },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------- deal detail

export type DealHistoryItem = {
  action: string; // pre-formatted for HistoryTimeline's label(): underscores → spaces
  actorName: string;
  from?: string;
  to?: string;
  note?: string;
  createdAt: Date;
};

export type DealDetail = {
  deal: {
    id: string;
    name: string;
    stage: DealStage;
    valueCents: number;
    notes: string | null;
    discoveryMd: string | null;
    createdAt: Date;
    daysInStage: number;
    stuck: boolean;
    origin: "captured" | "qualified_from_triage" | "bypass" | "spawned_from_project";
    subStatus: string | null;
    depositCents: number;
    depositSentAt: Date | null;
    depositPaidAt: Date | null;
    readinessScore: number | null;
    postMortemMd: string | null;
  };
  org: { id: string; name: string; status: string };
  owner: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  /** Where this came from — capture data + scout opinion on the (shared) contact. */
  provenance: { source: string | null; notes: string | null; origin: string; createdAt: Date; scoutMd: string | null; scoutScore: number | null; scoutVerdict: "pursue" | "probe" | "pass" | null } | null;
  history: DealHistoryItem[];
  /** Stages this deal actually passed through (for the spine's skipped-vs-visited render). */
  visitedStages: DealStage[];
};

/** One deal with its people, provenance, and audited stage history (R2 attaches here). */
export async function getDealDetail(ctx: AuthContext, dealId: string): Promise<DealDetail> {
  assertStaff(ctx, "get_deal_detail");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(deal.organizationId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "get_deal_detail", resource: `deal:${dealId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Deal not found.");
  }

  const [org, owner, contact, auditRows] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }),
    deal.ownerUserId ? db.query.users.findFirst({ where: eq(schema.users.id, deal.ownerUserId) }) : null,
    deal.primaryContactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null,
    db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, "deal"), eq(schema.auditLog.entityId, dealId)))
      .orderBy(desc(schema.auditLog.createdAt)),
  ]);
  if (!org) throw new StageError("NOT_FOUND", "Deal not found.");

  const actorIds = [...new Set(auditRows.map((a) => a.actorUserId).filter((v): v is string => !!v))];
  const actorName = new Map<string, string>();
  if (actorIds.length > 0) {
    const actors = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.id, actorIds));
    for (const a of actors) actorName.set(a.id, a.name);
  }

  const history: DealHistoryItem[] = auditRows.map((a) => {
    const meta = (a.metadata ?? {}) as { from?: string; to?: string; reason?: string };
    if (a.action === "deal.stage_changed") {
      return {
        action: "moved_this_deal",
        actorName: a.actorUserId ? actorName.get(a.actorUserId) ?? "Someone" : "System",
        from: isDealStage(meta.from ?? "") ? STAGE_META[meta.from as DealStage].label : meta.from,
        to: isDealStage(meta.to ?? "") ? STAGE_META[meta.to as DealStage].label : meta.to,
        note: meta.reason,
        createdAt: a.createdAt,
      };
    }
    const FRIENDLY: Record<string, string> = {
      "lead.qualified": "qualified_the_contact",
      "contact.qualified": "qualified_the_contact",
      "contact.bypassed_triage": "started_the_deal_(triage_bypass)",
      "stage.migrated_5col": "migrated_to_the_5-stage_board",
    };
    return {
      action: FRIENDLY[a.action] ?? a.action.replace(/\./g, "_"),
      actorName: a.actorUserId ? actorName.get(a.actorUserId) ?? "Someone" : "System",
      createdAt: a.createdAt,
    };
  });

  // Reconstruct visited stages from the audit trail: deals start at discovery, and
  // every logged move contributes its from/to. Anything else on the spine was skipped.
  const visited = new Set<DealStage>(["discovery", deal.stage]);
  for (const a of auditRows) {
    if (a.action !== "deal.stage_changed") continue;
    const meta = (a.metadata ?? {}) as { from?: string; to?: string };
    if (meta.from && isDealStage(meta.from)) visited.add(meta.from);
    if (meta.to && isDealStage(meta.to)) visited.add(meta.to);
  }

  const now = new Date();
  const sla = await getSlaSettings();
  return {
    deal: {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      valueCents: deal.valueCents,
      notes: deal.notes,
      discoveryMd: deal.discoveryMd,
      createdAt: deal.createdAt,
      daysInStage: daysInStage(deal.stageEnteredAt, now),
      stuck: isStuckWith(deal.stage, deal.stageEnteredAt, now, sla),
      origin: deal.origin,
      subStatus: deal.subStatus,
      depositCents: deal.depositCents,
      depositSentAt: deal.depositSentAt,
      depositPaidAt: deal.depositPaidAt,
      readinessScore: deal.readinessScore,
      postMortemMd: deal.postMortemMd,
    },
    org: { id: org.id, name: org.name, status: org.status },
    owner: owner ? { id: owner.id, name: owner.name } : null,
    contact: contact ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone } : null,
    provenance: contact
      ? { source: contact.source, notes: contact.notes, origin: deal.origin, createdAt: contact.createdAt, scoutMd: contact.aiAnalysisMd, scoutScore: contact.aiScore, scoutVerdict: contact.aiVerdict }
      : null,
    history,
    visitedStages: [...visited],
  };
}

// ---------------------------------------------------------------- funnel view

export type FunnelColumn = {
  stage: DealStage;
  label: string;
  probabilityPct: number | null;
  toward: "proposal" | "close" | null;
  deals: DealItem[];
};

export type SalesOverview = {
  /** Contacts still to qualify — the Triage column. */
  triage: ContactItem[];
  columns: FunnelColumn[];
  wonDeals: DealItem[];
  lostDeals: DealItem[];
  lostCount: number;
  openPipelineCents: number;
  /** Anchor-weighted pipeline (close-race stages without an anchor weigh 50%). Rough by design. */
  openWeightedCents: number;
  stuckCount: number;
  /** Σ value of proposal-out deals past the follow-up SLA — the at-risk clock. */
  atRiskCents: number;
  wonThisQCount: number;
  wonThisQCents: number;
  lostThisQCount: number;
  /** Won / (won + lost) this quarter, percent; null when nothing closed this quarter. */
  winRatePct: number | null;
};

/** Everything the Sales page needs: triage contacts + stage-grouped open pipeline. */
export async function salesOverview(ctx: AuthContext): Promise<SalesOverview> {
  assertStaff(ctx, "sales_overview");
  const sla = await getSlaSettings();
  const [triage, deals] = await Promise.all([listTriageContacts(ctx), loadDealItems(ctx, sla)]);

  // Effective anchors come from SLA settings (admin-tunable); STAGE_META supplies the label/toward.
  const anchorFor = (stage: DealStage): number | null =>
    stage in sla.probabilityAnchors ? sla.probabilityAnchors[stage] : STAGE_META[stage].probabilityPct;

  const columns: FunnelColumn[] = FUNNEL_STAGES.map((stage) => ({
    stage,
    label: STAGE_META[stage].label,
    probabilityPct: anchorFor(stage),
    toward: STAGE_META[stage].toward,
    deals: deals.filter((d) => d.stage === stage),
  }));
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");

  // "This quarter" = deals whose terminal move (stageEnteredAt) landed after Q start.
  const now = new Date();
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");
  const wonThisQ = wonDeals.filter((d) => d.stageEnteredAt >= qStart);
  const lostThisQCount = lostDeals.filter((d) => d.stageEnteredAt >= qStart).length;
  const closedThisQ = wonThisQ.length + lostThisQCount;

  return {
    triage,
    columns,
    wonDeals,
    lostDeals,
    lostCount: lostDeals.length,
    openPipelineCents: open.reduce((n, d) => n + d.valueCents, 0),
    openWeightedCents: Math.round(
      open.reduce((n, d) => n + d.valueCents * ((anchorFor(d.stage) ?? 50) / 100), 0),
    ),
    stuckCount: open.filter((d) => d.stuck).length,
    atRiskCents: open.filter((d) => d.proposalSilent).reduce((n, d) => n + d.valueCents, 0),
    wonThisQCount: wonThisQ.length,
    wonThisQCents: wonThisQ.reduce((n, d) => n + d.valueCents, 0),
    lostThisQCount,
    winRatePct: closedThisQ > 0 ? Math.round((wonThisQ.length / closedThisQ) * 100) : null,
  };
}
