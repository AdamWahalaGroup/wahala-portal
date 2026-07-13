/**
 * Opportunities pipeline service (HANDOFF-DELTA-2026-07-09 restructure).
 *
 * "Lead" and "Triage" are retired: an OPPORTUNITY is not a new object — it is the
 * deal record at stage 'new', attached to a contact from day one. The account is
 * optional at creation and is born at Create project → if still missing. Accepting
 * an opportunity flips it into Discovery (same record, badge flips). Deals move
 * freely between stages — dispositions, not a state machine — and every move is
 * audited so the funnel history is reconstructable. Winning a deal flips the org
 * to 'active': the prospect became a customer.
 *
 * RBAC: any staff can view and start opportunities; deal edits and stage moves
 * need admin or account_owner (same tier as quoting).
 */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { isDealStage, daysInStage, FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";
import { isStuckWith, type SlaSettings } from "@/domain/sla";
import { getSlaSettings } from "@/services/sla-settings";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import {
  actionUrgencyScore,
  isBudgetStatus,
  isDataSensitivity,
  isDeliveryModel,
  isEngagementType,
  isIpDisposition,
  isNextActionCourt,
  type BudgetStatus,
  type DataSensitivity,
  type DeliveryModel,
  type EngagementType,
  type IpDisposition,
  type NextActionCourt,
} from "@/domain/deal-operating-model";

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

// ---------------------------------------------------------------- contacts (people first)
// A contact can stand alone; an account only exists once at least one contact
// hangs off it. Nothing here is a pipeline — the pipeline is deals.

export type ContactLite = {
  id: string;
  name: string;
  email: string | null;
  organizationId: string | null;
  organizationName: string | null;
  title: string | null;
  source: string | null;
  /** Deals where this contact is primary — the Contacts-page column. */
  opportunityCount: number;
};

/** Every contact, for pickers (New-opportunity modal) and the Contacts page. */
export async function listContactsLite(ctx: AuthContext): Promise<ContactLite[]> {
  assertStaff(ctx, "list_contacts");
  const db = getDb();
  const [rows, dealRows] = await Promise.all([
    db.select().from(schema.contacts).orderBy(schema.contacts.name),
    db.select({ primaryContactId: schema.deals.primaryContactId }).from(schema.deals),
  ]);
  const orgIds = [...new Set(rows.map((c) => c.organizationId).filter((v): v is string => !!v))];
  const orgs =
    orgIds.length > 0
      ? await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))
      : [];
  const orgNames = new Map(orgs.map((o) => [o.id, o.name]));
  const oppCount = new Map<string, number>();
  for (const d of dealRows) {
    if (d.primaryContactId) oppCount.set(d.primaryContactId, (oppCount.get(d.primaryContactId) ?? 0) + 1);
  }
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    organizationId: c.organizationId,
    organizationName: c.organizationId ? orgNames.get(c.organizationId) ?? null : null,
    title: c.title,
    source: c.source,
    opportunityCount: oppCount.get(c.id) ?? 0,
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

/** Resolve/validate the deal owner — defaults to the acting user. */
async function resolveOwner(ctx: AuthContext, ownerUserId?: string): Promise<string> {
  if (!ownerUserId?.trim() || ownerUserId.trim() === ctx.user.id) return ctx.user.id;
  const db = getDb();
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, ownerUserId.trim()) });
  if (!owner || owner.userType !== "wahala" || owner.status === "disabled") {
    throw new StageError("VALIDATION", "That owner isn't an active staff member.");
  }
  return owner.id;
}

/** Resolve/validate/create the (optional) account. Returns [orgId | null, insert stmts]. */
async function resolveAccount(
  ctx: AuthContext,
  input: { organizationId?: string; newAccountName?: string },
): Promise<{ organizationId: string | null; accountName: string | null; statements: unknown[] }> {
  const db = getDb();
  const organizationId = input.organizationId?.trim() || null;
  if (organizationId) {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
    if (!org) throw new StageError("VALIDATION", "That account does not exist.");
    return { organizationId, accountName: org.name, statements: [] };
  }
  if (input.newAccountName?.trim()) {
    const id = crypto.randomUUID();
    return {
      organizationId: id,
      accountName: input.newAccountName.trim(),
      statements: [
        db.insert(schema.organizations).values({
          id,
          name: input.newAccountName.trim(),
          status: "prospect",
          accountOwnerUserId: ctx.user.id,
          ownerAssignedAt: new Date(),
        }),
      ],
    };
  }
  return { organizationId: null, accountName: null, statements: [] };
}

/**
 * Start an OPPORTUNITY (HANDOFF-DELTA-2026-07-09 §3): a deal at stage 'new' on a
 * contact — existing or created inline — with the account optional (existing /
 * created inline / none). "What do they need" seeds the deal name and the
 * discovery note; est value and source travel like they always did. Any staff.
 */
export async function createOpportunity(
  ctx: AuthContext,
  input: {
    contactId?: string;
    contactName?: string;
    contactEmail?: string;
    organizationId?: string;
    newAccountName?: string;
    /** "What do they need" — seeds the opportunity name + discovery note. */
    need?: string;
    estValueCents?: number;
    source?: string;
    ownerUserId?: string;
  },
): Promise<{ dealId: string; contactId: string; organizationId?: string }> {
  assertStaff(ctx, "create_opportunity");
  const db = getDb();
  const now = new Date();
  const ownerUserId = await resolveOwner(ctx, input.ownerUserId);
  const { organizationId, accountName, statements } = await resolveAccount(ctx, input);

  // The contact: pick an existing one, or create it inline (name is enough).
  let contactId = input.contactId?.trim() || null;
  let contactName: string;
  if (contactId) {
    const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
    if (!contact) throw new StageError("VALIDATION", "That contact does not exist.");
    contactName = contact.name;
    // A contact without an account adopts the one chosen here (never overwrites).
    if (organizationId && !contact.organizationId) {
      statements.push(db.update(schema.contacts).set({ organizationId }).where(eq(schema.contacts.id, contactId)));
    }
  } else {
    contactName = input.contactName?.trim() ?? "";
    if (!contactName) throw new StageError("VALIDATION", "An opportunity needs a contact — pick one or give a name.");
    contactId = crypto.randomUUID();
    statements.push(
      db.insert(schema.contacts).values({
        id: contactId,
        organizationId,
        name: contactName,
        email: input.contactEmail?.trim().toLowerCase() || null,
        source: input.source?.trim() || null,
        estValueCents: Math.max(0, Math.round(input.estValueCents ?? 0)),
        state: "qualified",
        createdByUserId: ctx.user.id,
        assignedToUserId: ownerUserId,
      }),
    );
  }
  if (organizationId && contactId) {
    const existingLink = await db.query.contactCompanies.findFirst({
      where: and(eq(schema.contactCompanies.contactId, contactId), eq(schema.contactCompanies.organizationId, organizationId)),
    });
    if (!existingLink) statements.push(db.insert(schema.contactCompanies).values({ contactId, organizationId, isPrimary: true }));
  }

  // "{account-or-contact name} — {first ~36 chars of the need}" (prototype).
  const need = input.need?.trim() || null;
  const shortNeed = need ? (need.length > 36 ? `${need.slice(0, 36).trimEnd()}…` : need) : "opportunity";
  const dealId = crypto.randomUUID();
  statements.push(
    db.insert(schema.deals).values({
      id: dealId,
      organizationId,
      name: `${accountName ?? contactName} — ${shortNeed}`,
      stage: "new",
      stageEnteredAt: now,
      ownerUserId,
      primaryContactId: contactId,
      origin: "captured",
      valueCents: Math.max(0, Math.round(input.estValueCents ?? 0)),
      notes: need,
      discoveryNote: need,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId: ctx.user.id,
        action: "opportunity.created",
        entityType: "deal",
        entityId: dealId,
        metadata: { contactId, contactName, source: input.source ?? null },
      }),
    ),
  );

  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { dealId, contactId, organizationId: organizationId ?? undefined };
}

/**
 * "New contact + account" (HANDOFF-DELTA-2026-07-09 §3): a deliberate person(+company)
 * record with NO opportunity — due diligence first, start an opportunity later. NO
 * portal invite goes out on create (founder call, 09 Jul — restores the 08 Jul §3
 * timing): the invite is a deliberate step from the contact page's Portal access
 * card, which the creator lands on next.
 */
export async function createContactWithAccount(
  ctx: AuthContext,
  input: {
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    organizationId?: string;
    newAccountName?: string;
    notes?: string;
    source?: string;
  },
): Promise<{ contactId: string; organizationId?: string }> {
  assertStaff(ctx, "create_contact");
  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "A contact needs at least a name.");
  const db = getDb();
  const { organizationId, statements } = await resolveAccount(ctx, input);
  const contactId = crypto.randomUUID();
  const email = input.email?.trim().toLowerCase() || null;

  statements.push(
    db.insert(schema.contacts).values({
      id: contactId,
      organizationId,
      name,
      email,
      phone: input.phone?.trim() || null,
      title: input.title?.trim() || null,
      source: input.source?.trim() || null,
      notes: input.notes?.trim() || null,
      state: "qualified",
      createdByUserId: ctx.user.id,
      assignedToUserId: ctx.user.id,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId: ctx.user.id,
        action: "contact.created",
        entityType: "contact",
        entityId: contactId,
        metadata: { name, email },
      }),
    ),
  );
  if (organizationId) {
    statements.push(db.insert(schema.contactCompanies).values({ contactId, organizationId, isPrimary: true }));
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { contactId, organizationId: organizationId ?? undefined };
}

// ---------------------------------------------------------------- deals

export type DealItem = {
  id: string;
  name: string;
  stage: DealStage;
  /** Null until the account exists — born at Create project → for account-less deals. */
  organizationId: string | null;
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
  /** The explicit mutual commitment wins over generic stage advice. */
  nextAction: string | null;
  nextActionDueAt: Date | null;
  nextActionCourt: NextActionCourt;
  actionUrgencyScore: number;
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
  /** Set once Create project → ran — the board's won-drag guard reads it. */
  projectId: string | null;
  /** Agent layer: business-fit 0–10 + the derived priority (Home queue / list sort). */
  fitScore: number | null;
  engagementHealthScore: number | null;
  priorityScore: number | null;
};

async function loadDealItems(ctx: AuthContext, sla: SlaSettings): Promise<DealItem[]> {
  const db = getDb();
  let rows = await db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt));
  // Non-admin staff see deals only for orgs in their access scope, matching listClients.
  // Account-less deals belong to no account, so account-scoping doesn't apply — all staff see them.
  const scope = ctx.accessScope;
  if (scope.kind !== "all") rows = rows.filter((d) => !d.organizationId || scope.orgIds.includes(d.organizationId));
  if (rows.length === 0) return [];

  const orgIds = [...new Set(rows.map((d) => d.organizationId).filter((v): v is string => !!v))];
  const userIds = [...new Set(rows.map((d) => d.ownerUserId).filter((v): v is string => !!v))];
  const contactIds = [...new Set(rows.map((d) => d.primaryContactId).filter((v): v is string => !!v))];
  const dealIds = rows.map((d) => d.id);
  const projectIds = [...new Set(rows.map((d) => d.projectId).filter((v): v is string => !!v))];

  const [orgs, owners, people, sentProposals, agRows, projects] = await Promise.all([
    orgIds.length > 0
      ? db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))
      : Promise.resolve([] as { id: string; name: string }[]),
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
    orgIds.length > 0
      ? db
          .select({ organizationId: schema.agreements.organizationId, dealId: schema.agreements.dealId, kind: schema.agreements.kind, status: schema.agreements.status })
          .from(schema.agreements)
          .where(inArray(schema.agreements.organizationId, orgIds))
      : Promise.resolve([] as { organizationId: string; dealId: string | null; kind: string; status: string }[]),
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
      // Account-less deals surface the contact's name — the person IS the record.
      organizationName: (d.organizationId ? orgName.get(d.organizationId) : null) ?? contact?.name ?? "No account yet",
      ownerUserId: d.ownerUserId,
      ownerName: d.ownerUserId ? ownerName.get(d.ownerUserId) ?? null : null,
      contactName: contact?.name ?? null,
      valueCents: d.valueCents,
      daysInStage: daysInStage(d.stageEnteredAt, now),
      stuck: isStuckWith(d.stage, d.stageEnteredAt, now, sla),
      stageEnteredAt: d.stageEnteredAt,
      notes: d.notes,
      nextStep: d.nextAction ?? nextStepFor(d.stage),
      nextAction: d.nextAction,
      nextActionDueAt: d.nextActionDueAt,
      nextActionCourt: d.nextActionCourt,
      actionUrgencyScore: actionUrgencyScore({ nextAction: d.nextAction, nextActionDueAt: d.nextActionDueAt, now }),
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
      msaOnFile: !!d.organizationId && msaOrgs.has(d.organizationId),
      paidDiscovery: d.origin === "spawned_from_project" || (d.projectId ? projectKind.get(d.projectId) === "paid_discovery" : false),
      readinessScore: d.readinessScore,
      projectId: d.projectId,
      fitScore: d.fitScore,
      engagementHealthScore: d.engagementHealthScore,
      priorityScore: d.priorityScore,
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

  // Stage moves clear stage-specific labels and the completed commitment. Every
  // new open stage must state its own dated next commitment; closed deals have
  // no action urgency.
  const closed = stage === "won" || stage === "lost";
  const moveDeal = db
    .update(schema.deals)
    .set({
      stage,
      stageEnteredAt: new Date(),
      subStatus: null,
      nextAction: null,
      nextActionDueAt: null,
      nextActionCourt: "wahala",
      actionUrgencyScore: closed ? 0 : 100,
    })
    .where(eq(schema.deals.id, dealId));
  const transitionMetadata = {
    from: deal.stage,
    to: stage,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    ...(deal.nextAction
      ? {
          completedCommitment: {
            action: deal.nextAction,
            dueAt: deal.nextActionDueAt?.toISOString() ?? null,
            court: deal.nextActionCourt,
          },
        }
      : {}),
  };
  const audit = db.insert(schema.auditLog).values(
    buildAudit({
      organizationId: deal.organizationId,
      actorUserId: ctx.user.id,
      action: "deal.stage_changed",
      entityType: "deal",
      entityId: dealId,
      metadata: transitionMetadata,
    }),
  );
  if (stage === "won" && deal.organizationId) {
    // The prospect became a customer — the contract→project seam takes over from here.
    // The Discovery Package graduates into the client's durable AI memory so every
    // later AI feature (project drafts, proposals) is grounded in what sales learned.
    // (An account-less deal reaches Won only via Create project →, which births the
    // account and re-links the deal before calling here.)
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

export type DealUpdateInput = {
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
};

function inputDate(value: string | null, label: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new StageError("VALIDATION", `${label} is not a valid date.`);
  return parsed;
}

export async function updateDeal(
  ctx: AuthContext,
  dealId: string,
  input: DealUpdateInput,
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
  if (input.engagementType !== undefined) {
    if (input.engagementType !== null && !isEngagementType(input.engagementType)) throw new StageError("VALIDATION", "Unknown engagement type.");
    patch.engagementType = input.engagementType;
  }
  if (input.deliveryModel !== undefined) {
    if (input.deliveryModel !== null && !isDeliveryModel(input.deliveryModel)) throw new StageError("VALIDATION", "Unknown delivery model.");
    patch.deliveryModel = input.deliveryModel;
  }
  if (input.ipDisposition !== undefined) {
    if (!isIpDisposition(input.ipDisposition)) throw new StageError("VALIDATION", "Unknown IP disposition.");
    patch.ipDisposition = input.ipDisposition;
  }
  if (input.dataSensitivity !== undefined) {
    if (!isDataSensitivity(input.dataSensitivity)) throw new StageError("VALIDATION", "Unknown data sensitivity.");
    patch.dataSensitivity = input.dataSensitivity;
  }
  if (input.supportExpectation !== undefined) patch.supportExpectation = input.supportExpectation?.trim() || null;
  if (input.expectedCloseAt !== undefined) patch.expectedCloseAt = inputDate(input.expectedCloseAt, "Expected close date");
  if (input.nextAction !== undefined) patch.nextAction = input.nextAction?.trim() || null;
  if (input.nextActionDueAt !== undefined) patch.nextActionDueAt = inputDate(input.nextActionDueAt, "Next-action due date");
  if (input.nextActionCourt !== undefined) {
    if (!isNextActionCourt(input.nextActionCourt)) throw new StageError("VALIDATION", "Unknown next-action owner.");
    patch.nextActionCourt = input.nextActionCourt;
  }
  if (input.champion !== undefined) patch.champion = input.champion?.trim() || null;
  if (input.economicBuyer !== undefined) patch.economicBuyer = input.economicBuyer?.trim() || null;
  if (input.compellingEvent !== undefined) patch.compellingEvent = input.compellingEvent?.trim() || null;
  if (input.decisionProcess !== undefined) patch.decisionProcess = input.decisionProcess?.trim() || null;
  if (input.budgetStatus !== undefined) {
    if (!isBudgetStatus(input.budgetStatus)) throw new StageError("VALIDATION", "Unknown budget status.");
    patch.budgetStatus = input.budgetStatus;
  }
  if (input.budgetEvidence !== undefined) patch.budgetEvidence = input.budgetEvidence?.trim() || null;
  if (Object.keys(patch).length === 0) return;
  if (input.nextAction !== undefined || input.nextActionDueAt !== undefined) {
    patch.actionUrgencyScore = actionUrgencyScore({
      nextAction: patch.nextAction === undefined ? deal.nextAction : patch.nextAction,
      nextActionDueAt: patch.nextActionDueAt === undefined ? deal.nextActionDueAt : patch.nextActionDueAt,
      now: new Date(),
    });
  }
  const changedFields = Object.keys(patch).filter((key) => key !== "actionUrgencyScore");
  const commitmentChanged = input.nextAction !== undefined || input.nextActionDueAt !== undefined || input.nextActionCourt !== undefined;
  const auditMetadata = {
    changedFields,
    ...(commitmentChanged
      ? {
          commitment: {
            from: { action: deal.nextAction, dueAt: deal.nextActionDueAt?.toISOString() ?? null, court: deal.nextActionCourt },
            to: {
              action: patch.nextAction === undefined ? deal.nextAction : patch.nextAction,
              dueAt: (patch.nextActionDueAt === undefined ? deal.nextActionDueAt : patch.nextActionDueAt)?.toISOString() ?? null,
              court: patch.nextActionCourt === undefined ? deal.nextActionCourt : patch.nextActionCourt,
            },
          },
        }
      : {}),
  };
  await db.batch([
    db.update(schema.deals).set(patch).where(eq(schema.deals.id, dealId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "deal.updated",
        entityType: "deal",
        entityId: dealId,
        metadata: auditMetadata,
      }),
    ),
  ]);
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

/**
 * DEV TOOL — hard-delete a deal and everything hanging off it (proposals +
 * options, discovery package, calls, process events, contract checklist,
 * deal-scoped agreements, deal audit rows; meetings keep their calendar mirror
 * but lose the link). Admin only, for redoing walkthroughs with the same data.
 * The PRODUCT path stays "Mark lost with a reason" — these buttons come out
 * once the system settles.
 */
export async function deleteDeal(ctx: AuthContext, dealId: string): Promise<void> {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "delete_deal", resource: `deal:${dealId}`, reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can delete a deal.");
  }
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  if (deal.projectId) {
    throw new StageError("INVALID_STATE", "This deal already created a project — delete the account (dev tool) or archive it instead.");
  }

  const proposalIds = (
    await db.select({ id: schema.proposals.id }).from(schema.proposals).where(eq(schema.proposals.dealId, dealId))
  ).map((p) => p.id);

  const statements = [
    ...(proposalIds.length > 0 ? [db.delete(schema.proposalOptions).where(inArray(schema.proposalOptions.proposalId, proposalIds))] : []),
    db.delete(schema.proposals).where(eq(schema.proposals.dealId, dealId)),
    db.delete(schema.discoveryPackages).where(eq(schema.discoveryPackages.dealId, dealId)),
    db.delete(schema.dealCalls).where(eq(schema.dealCalls.dealId, dealId)),
    db.delete(schema.processEvents).where(eq(schema.processEvents.dealId, dealId)),
    db.delete(schema.contractItems).where(eq(schema.contractItems.dealId, dealId)),
    db.delete(schema.agreements).where(eq(schema.agreements.dealId, dealId)),
    db.delete(schema.suggestions).where(eq(schema.suggestions.dealId, dealId)),
    db.update(schema.meetings).set({ dealId: null }).where(eq(schema.meetings.dealId, dealId)),
    db.delete(schema.auditLog).where(and(eq(schema.auditLog.entityType, "deal"), eq(schema.auditLog.entityId, dealId))),
    db.delete(schema.deals).where(eq(schema.deals.id, dealId)),
  ];
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "delete_deal", resource: `deal:${dealId}`, reason: "admin_hard_delete" });
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
    /** Set once Create project → ran — the drawer's Project → link. */
    projectId: string | null;
    /** Agent layer: fit chip + money meter (docs/AGENT-LAYER-DESIGN.md). */
    fitScore: number | null;
    fitRationaleMd: string | null;
    priorityScore: number | null;
    engagementHealthScore: number | null;
    actionUrgencyScore: number | null;
    agentSpendCents: number;
    engagementType: EngagementType | null;
    deliveryModel: DeliveryModel | null;
    ipDisposition: IpDisposition;
    dataSensitivity: DataSensitivity;
    supportExpectation: string | null;
    expectedCloseAt: Date | null;
    nextAction: string | null;
    nextActionDueAt: Date | null;
    nextActionCourt: NextActionCourt;
    champion: string | null;
    economicBuyer: string | null;
    compellingEvent: string | null;
    decisionProcess: string | null;
    budgetStatus: BudgetStatus;
    budgetEvidence: string | null;
  };
  /** Null until the account exists (account-less opportunity). */
  org: { id: string; name: string; status: string } | null;
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
  if (scope.kind !== "all" && deal.organizationId && !scope.orgIds.includes(deal.organizationId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "get_deal_detail", resource: `deal:${dealId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Deal not found.");
  }

  const [org, owner, contact, auditRows] = await Promise.all([
    deal.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }) : null,
    deal.ownerUserId ? db.query.users.findFirst({ where: eq(schema.users.id, deal.ownerUserId) }) : null,
    deal.primaryContactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null,
    db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, "deal"), eq(schema.auditLog.entityId, dealId)))
      .orderBy(desc(schema.auditLog.createdAt)),
  ]);
  if (deal.organizationId && !org) throw new StageError("NOT_FOUND", "Deal not found.");

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
      projectId: deal.projectId,
      fitScore: deal.fitScore,
      fitRationaleMd: deal.fitRationaleMd,
      priorityScore: deal.priorityScore,
      engagementHealthScore: deal.engagementHealthScore,
      actionUrgencyScore: deal.actionUrgencyScore,
      agentSpendCents: deal.agentSpendCents,
      engagementType: deal.engagementType,
      deliveryModel: deal.deliveryModel,
      ipDisposition: deal.ipDisposition,
      dataSensitivity: deal.dataSensitivity,
      supportExpectation: deal.supportExpectation,
      expectedCloseAt: deal.expectedCloseAt,
      nextAction: deal.nextAction,
      nextActionDueAt: deal.nextActionDueAt,
      nextActionCourt: deal.nextActionCourt,
      champion: deal.champion,
      economicBuyer: deal.economicBuyer,
      compellingEvent: deal.compellingEvent,
      decisionProcess: deal.decisionProcess,
      budgetStatus: deal.budgetStatus,
      budgetEvidence: deal.budgetEvidence,
    },
    org: org ? { id: org.id, name: org.name, status: org.status } : null,
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
  columns: FunnelColumn[];
  /** Opportunities waiting to be accepted (stage 'new') — badge + Home strip. */
  newOppCount: number;
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

/** Everything the Opportunities page needs: the stage-grouped open pipeline. */
export async function salesOverview(ctx: AuthContext): Promise<SalesOverview> {
  assertStaff(ctx, "sales_overview");
  const sla = await getSlaSettings();
  const deals = await loadDealItems(ctx, sla);

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
    columns,
    newOppCount: deals.filter((d) => d.stage === "new").length,
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
