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
import { isDealStage, daysInStage, isStuck, FUNNEL_STAGES, STAGE_META, type DealStage } from "@/domain/sales";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

function assertStaff(ctx: AuthContext, action: string): void {
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Wahala staff only.");
  }
}

function assertSalesManager(ctx: AuthContext, action: string): void {
  assertStaff(ctx, action);
  if (!(ctx.isAdmin || ctx.user.role === "account_owner")) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_admin_or_owner" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or account owner can do that.");
  }
}

// ---------------------------------------------------------------- leads

export type LeadItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  industry: string | null;
  notes: string | null;
  status: "new" | "qualified" | "disqualified";
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdAt: Date;
};

export async function listLeads(ctx: AuthContext): Promise<LeadItem[]> {
  assertStaff(ctx, "list_leads");
  const db = getDb();
  const rows = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt));
  const userIds = [...new Set(rows.map((l) => l.assignedToUserId).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const staff = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));
    for (const s of staff) names.set(s.id, s.name);
  }
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    company: l.company,
    email: l.email,
    phone: l.phone,
    source: l.source,
    industry: l.industry,
    notes: l.notes,
    status: l.status,
    assignedToUserId: l.assignedToUserId,
    assignedToName: l.assignedToUserId ? names.get(l.assignedToUserId) ?? null : null,
    createdAt: l.createdAt,
  }));
}

/**
 * Hand a lead to a salesperson (or back to the unowned pool with null). Any staff
 * member can assign — claiming a lead is a soft act, not a gate.
 */
export async function assignLead(ctx: AuthContext, leadId: string, userId: string | null): Promise<void> {
  assertStaff(ctx, "assign_lead");
  const db = getDb();
  if (userId) {
    const [target] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, userId), eq(schema.users.userType, "wahala"), ne(schema.users.status, "disabled")));
    if (!target) throw new StageError("VALIDATION", "Leads can only be assigned to active Wahala staff.");
  }
  const [row] = await db
    .update(schema.leads)
    .set({ assignedToUserId: userId })
    .where(eq(schema.leads.id, leadId))
    .returning({ id: schema.leads.id });
  if (!row) throw new StageError("NOT_FOUND", "Lead not found.");
}

export async function createLead(
  ctx: AuthContext,
  input: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    source?: string;
    industry?: string;
    notes?: string;
  },
): Promise<{ id: string }> {
  assertStaff(ctx, "create_lead");
  const name = input.name?.trim();
  if (!name) throw new StageError("VALIDATION", "A lead needs at least a name.");
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(schema.leads).values({
    id,
    name,
    company: input.company?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    source: input.source?.trim() || null,
    industry: input.industry?.trim() || null,
    notes: input.notes?.trim() || null,
    createdByUserId: ctx.user.id,
  });
  return { id };
}

export async function disqualifyLead(ctx: AuthContext, leadId: string): Promise<void> {
  assertSalesManager(ctx, "disqualify_lead");
  const db = getDb();
  const [row] = await db
    .update(schema.leads)
    .set({ status: "disqualified" })
    .where(eq(schema.leads.id, leadId))
    .returning({ id: schema.leads.id });
  if (!row) throw new StageError("NOT_FOUND", "Lead not found.");
}

/**
 * Qualify a lead → organization (prospect) + contact (+ company link) + deal.
 * Either attaches to an existing organization or creates a new prospect org (no
 * portal users yet — client invites stay a separate, later act: onboardClient).
 */
export async function qualifyLead(
  ctx: AuthContext,
  leadId: string,
  input: { organizationId?: string; dealName?: string; valueCents?: number },
): Promise<{ dealId: string; organizationId: string }> {
  assertSalesManager(ctx, "qualify_lead");
  const db = getDb();
  const lead = await db.query.leads.findFirst({ where: eq(schema.leads.id, leadId) });
  if (!lead) throw new StageError("NOT_FOUND", "Lead not found.");
  if (lead.status !== "new") throw new StageError("INVALID_STATE", `Lead is already ${lead.status}.`);

  let organizationId = input.organizationId?.trim() || null;
  const now = new Date();
  const dealId = crypto.randomUUID();
  const contactId = crypto.randomUUID();
  const dealName = input.dealName?.trim() || `${lead.company || lead.name} — opportunity`;
  const valueCents = Math.max(0, Math.round(input.valueCents ?? 0));

  const statements = [];
  if (organizationId) {
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, organizationId) });
    if (!org) throw new StageError("VALIDATION", "That organization does not exist.");
  } else {
    if (!lead.company?.trim()) {
      throw new StageError("VALIDATION", "Add a company name to the lead (or pick an existing client) before qualifying.");
    }
    organizationId = crypto.randomUUID();
    statements.push(
      db.insert(schema.organizations).values({
        id: organizationId,
        name: lead.company.trim(),
        status: "prospect",
        accountOwnerUserId: ctx.user.id,
        ownerAssignedAt: now,
      }),
    );
  }

  statements.push(
    db.insert(schema.contacts).values({
      id: contactId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      notes: lead.notes,
    }),
    db.insert(schema.contactCompanies).values({
      contactId,
      organizationId,
      isPrimary: true,
    }),
    db.insert(schema.deals).values({
      id: dealId,
      organizationId,
      name: dealName,
      stage: "discovery",
      stageEnteredAt: now,
      ownerUserId: ctx.user.id,
      primaryContactId: contactId,
      sourceLeadId: lead.id,
      valueCents,
    }),
    db
      .update(schema.leads)
      .set({ status: "qualified", assignedToUserId: lead.assignedToUserId ?? ctx.user.id, convertedDealId: dealId })
      .where(eq(schema.leads.id, lead.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId: ctx.user.id,
        action: "lead.qualified",
        entityType: "deal",
        entityId: dealId,
        metadata: { leadId: lead.id, leadName: lead.name, dealName },
      }),
    ),
  );

  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { dealId, organizationId };
}

// ---------------------------------------------------------------- deals

export type DealItem = {
  id: string;
  name: string;
  stage: DealStage;
  organizationId: string;
  organizationName: string;
  ownerName: string | null;
  contactName: string | null;
  valueCents: number;
  daysInStage: number;
  stuck: boolean;
  notes: string | null;
};

async function loadDealItems(ctx: AuthContext): Promise<DealItem[]> {
  const db = getDb();
  let rows = await db.select().from(schema.deals).orderBy(desc(schema.deals.createdAt));
  // Non-admin staff see deals only for orgs in their access scope, matching listClients.
  const scope = ctx.accessScope;
  if (scope.kind !== "all") rows = rows.filter((d) => scope.orgIds.includes(d.organizationId));
  if (rows.length === 0) return [];

  const orgIds = [...new Set(rows.map((d) => d.organizationId))];
  const userIds = [...new Set(rows.map((d) => d.ownerUserId).filter((v): v is string => !!v))];
  const contactIds = [...new Set(rows.map((d) => d.primaryContactId).filter((v): v is string => !!v))];

  const [orgs, owners, people] = await Promise.all([
    db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds)),
    userIds.length > 0
      ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, userIds))
      : Promise.resolve([]),
    contactIds.length > 0
      ? db.select({ id: schema.contacts.id, name: schema.contacts.name }).from(schema.contacts).where(inArray(schema.contacts.id, contactIds))
      : Promise.resolve([]),
  ]);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const ownerName = new Map(owners.map((u) => [u.id, u.name]));
  const contactName = new Map(people.map((c) => [c.id, c.name]));

  const now = new Date();
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    stage: d.stage,
    organizationId: d.organizationId,
    organizationName: orgName.get(d.organizationId) ?? "Unknown",
    ownerName: d.ownerUserId ? ownerName.get(d.ownerUserId) ?? null : null,
    contactName: d.primaryContactId ? contactName.get(d.primaryContactId) ?? null : null,
    valueCents: d.valueCents,
    daysInStage: daysInStage(d.stageEnteredAt, now),
    stuck: d.stage !== "won" && d.stage !== "lost" && isStuck(d.stageEnteredAt, now),
    notes: d.notes,
  }));
}

/**
 * Move a deal to any stage — dispositions, no transition rules. Records the move
 * in the audit log and resets the days-in-stage clock. Winning flips the org to
 * 'active' (prospect became customer).
 */
export async function setDealStage(ctx: AuthContext, dealId: string, stage: string): Promise<void> {
  assertSalesManager(ctx, "set_deal_stage");
  if (!isDealStage(stage)) throw new StageError("VALIDATION", "Unknown sales stage.");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  if (deal.stage === stage) return;

  const moveDeal = db.update(schema.deals).set({ stage, stageEnteredAt: new Date() }).where(eq(schema.deals.id, dealId));
  const audit = db.insert(schema.auditLog).values(
    buildAudit({
      organizationId: deal.organizationId,
      actorUserId: ctx.user.id,
      action: "deal.stage_changed",
      entityType: "deal",
      entityId: dealId,
      metadata: { from: deal.stage, to: stage },
    }),
  );
  if (stage === "won") {
    // The prospect became a customer — the contract→project seam takes over from here.
    const activateOrg = db
      .update(schema.organizations)
      .set({ status: "active" })
      .where(eq(schema.organizations.id, deal.organizationId));
    await db.batch([moveDeal, audit, activateOrg]);
  } else {
    await db.batch([moveDeal, audit]);
  }
}

export async function updateDeal(
  ctx: AuthContext,
  dealId: string,
  input: { name?: string; valueCents?: number; notes?: string },
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
  if (Object.keys(patch).length === 0) return;
  await db.update(schema.deals).set(patch).where(eq(schema.deals.id, dealId));
}

// ---------------------------------------------------------------- deal detail

export type DealHistoryItem = {
  action: string; // pre-formatted for HistoryTimeline's label(): underscores → spaces
  actorName: string;
  from?: string;
  to?: string;
  createdAt: Date;
};

export type DealDetail = {
  deal: {
    id: string;
    name: string;
    stage: DealStage;
    valueCents: number;
    notes: string | null;
    createdAt: Date;
    daysInStage: number;
    stuck: boolean;
  };
  org: { id: string; name: string; status: string };
  owner: { id: string; name: string } | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  sourceLead: { source: string | null; notes: string | null; createdAt: Date } | null;
  history: DealHistoryItem[];
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

  const [org, owner, contact, lead, auditRows] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }),
    deal.ownerUserId ? db.query.users.findFirst({ where: eq(schema.users.id, deal.ownerUserId) }) : null,
    deal.primaryContactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null,
    deal.sourceLeadId ? db.query.leads.findFirst({ where: eq(schema.leads.id, deal.sourceLeadId) }) : null,
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
    const meta = (a.metadata ?? {}) as { from?: string; to?: string };
    if (a.action === "deal.stage_changed") {
      return {
        action: "moved_this_deal",
        actorName: a.actorUserId ? actorName.get(a.actorUserId) ?? "Someone" : "System",
        from: isDealStage(meta.from ?? "") ? STAGE_META[meta.from as DealStage].label : meta.from,
        to: isDealStage(meta.to ?? "") ? STAGE_META[meta.to as DealStage].label : meta.to,
        createdAt: a.createdAt,
      };
    }
    return {
      action: a.action === "lead.qualified" ? "qualified_the_lead" : a.action.replace(/\./g, "_"),
      actorName: a.actorUserId ? actorName.get(a.actorUserId) ?? "Someone" : "System",
      createdAt: a.createdAt,
    };
  });

  const now = new Date();
  return {
    deal: {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      valueCents: deal.valueCents,
      notes: deal.notes,
      createdAt: deal.createdAt,
      daysInStage: daysInStage(deal.stageEnteredAt, now),
      stuck: deal.stage !== "won" && deal.stage !== "lost" && isStuck(deal.stageEnteredAt, now),
    },
    org: { id: org.id, name: org.name, status: org.status },
    owner: owner ? { id: owner.id, name: owner.name } : null,
    contact: contact ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone } : null,
    sourceLead: lead ? { source: lead.source, notes: lead.notes, createdAt: lead.createdAt } : null,
    history,
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
  leads: LeadItem[];
  columns: FunnelColumn[];
  wonDeals: DealItem[];
  lostCount: number;
  openPipelineCents: number;
  stuckCount: number;
};

/** Everything the Sales page needs: lead inbox + stage-grouped open pipeline. */
export async function salesOverview(ctx: AuthContext): Promise<SalesOverview> {
  assertStaff(ctx, "sales_overview");
  const [leads, deals] = await Promise.all([listLeads(ctx), loadDealItems(ctx)]);

  const columns: FunnelColumn[] = FUNNEL_STAGES.map((stage) => ({
    stage,
    label: STAGE_META[stage].label,
    probabilityPct: STAGE_META[stage].probabilityPct,
    toward: STAGE_META[stage].toward,
    deals: deals.filter((d) => d.stage === stage),
  }));
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");

  return {
    leads,
    columns,
    wonDeals: deals.filter((d) => d.stage === "won"),
    lostCount: deals.filter((d) => d.stage === "lost").length,
    openPipelineCents: open.reduce((n, d) => n + d.valueCents, 0),
    stuckCount: open.filter((d) => d.stuck).length,
  };
}
