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
import { DEFAULT_DATA_SENSITIVITY } from "@/domain/deal-operating-model";
import { getAccountHub, type AccountHub } from "@/services/account-hub";
import { listForAccount, msaOnFileFor, type AgreementRow } from "@/services/agreements";
import { assertSalesManager, assertStaff } from "@/services/sales";
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
  /** Sales axis — shown as a chip only while it's staff-relevant (to_qualify). */
  salesState: "to_qualify" | "qualified" | "passed";
  /** Portal-access axis — a DIFFERENT axis from qualification (QA delta 07-08 §4). */
  portalStatus: "invited" | "accepted" | null;
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
  /** Won/lost deals — the account's history, linkable (won first). */
  closedDeals: { id: string; name: string; stage: "won" | "lost"; valueCents: number }[];
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
  // Portal access is its own axis: match client logins to contacts by email.
  const portalUsers = await db
    .select({ email: schema.users.email, status: schema.users.status })
    .from(schema.users)
    .where(and(eq(schema.users.organizationId, orgId), eq(schema.users.userType, "client")));
  const portalByEmail = new Map(portalUsers.map((u) => [u.email.toLowerCase(), u.status === "active" ? ("accepted" as const) : u.status === "invited" ? ("invited" as const) : null]));
  const contacts: AccountContact[] = [...orgContacts, ...linkedContacts]
    .filter((c) => c.state !== "passed")
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      title: c.title,
      isPrimary: primaryIds.has(c.id) || c.id === primaryDealContact,
      salesState: c.state,
      portalStatus: c.email ? portalByEmail.get(c.email.toLowerCase()) ?? null : null,
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
    closedDeals: dealRows
      .filter((d): d is typeof d & { stage: "won" | "lost" } => d.stage === "won" || d.stage === "lost")
      .sort((a, b) => (a.stage === b.stage ? 0 : a.stage === "won" ? -1 : 1))
      .map((d) => ({ id: d.id, name: d.name, stage: d.stage, valueCents: d.valueCents })),
    agreements,
    timeline,
    projects: hub.projects.map((p) => ({
      ...p,
      kind: kindById.get(p.id) ?? "standard",
      spawnedFromDealName: spawnedByProject.get(p.id) ?? null,
    })),
  };
}

// ---------------------------------------------------------------- closeout → next deal (frame 37)

export type CloseoutPrompt = {
  orgId: string;
  accountName: string;
  projectName: string;
  acceptedAt: Date;
  collectedCents: number;
  msaOnFile: boolean;
  prefillName: string;
  prefillValueCents: number;
  contacts: { id: string; name: string }[];
};

/**
 * The closeout moment: a project whose FINAL stage is accepted proposes the next
 * deal on the same account — shown once to staff, dismissible. Returns null when
 * not applicable (open stages, already dismissed, or a next deal already spawned).
 */
export async function closeoutPromptFor(ctx: AuthContext, projectId: string): Promise<CloseoutPrompt | null> {
  if (!ctx.isStaff) return null;
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) return null;
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(project.organizationId)) return null;

  const stages = await db.select().from(schema.stages).where(eq(schema.stages.projectId, projectId));
  if (stages.length === 0 || !stages.every((s) => s.status === "accepted")) return null;

  const [dismissals, spawnedRows, org, contacts] = await Promise.all([
    db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.action, "project.closeout_dismissed"), eq(schema.auditLog.entityId, projectId))),
    db
      .select({ metadata: schema.auditLog.metadata })
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.action, "deal.created"), eq(schema.auditLog.organizationId, project.organizationId))),
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, project.organizationId) }),
    db
      .select({ id: schema.contacts.id, name: schema.contacts.name, state: schema.contacts.state })
      .from(schema.contacts)
      .where(eq(schema.contacts.organizationId, project.organizationId)),
  ]);
  if (!org) return null;
  if (dismissals.length > 0) return null;
  // A deal already spawned from THIS project → the loop is closed, no prompt.
  const alreadySpawned = spawnedRows.some((r) => {
    const m = (r.metadata ?? {}) as { originProjectId?: string | null };
    return m.originProjectId === projectId;
  });
  if (alreadySpawned) return null;

  const collectedCents = stages.reduce((n, s) => n + (s.paidAt ? s.totalAmountCents : 0), 0);
  const acceptedAt = stages.reduce<Date>((max, s) => (s.acceptedAt && s.acceptedAt > max ? s.acceptedAt : max), stages[0].acceptedAt ?? new Date());
  const msaOnFile = await msaOnFileFor(project.organizationId);

  return {
    orgId: project.organizationId,
    accountName: org.name,
    projectName: project.name,
    acceptedAt,
    collectedCents,
    msaOnFile,
    // Prefill from the accepted work: paid-discovery closeouts propose the build.
    prefillName: project.kind === "paid_discovery" ? `${org.name} — build from the roadmap` : `${org.name} — next engagement`,
    prefillValueCents: stages.reduce((n, s) => n + s.totalAmountCents, 0),
    contacts: contacts.filter((c) => c.state !== "passed").map((c) => ({ id: c.id, name: c.name })),
  };
}

/** "Not now" on the closeout prompt — dismiss once, logged. Staff. */
export async function dismissCloseoutPrompt(ctx: AuthContext, projectId: string): Promise<void> {
  assertStaff(ctx, "dismiss_closeout");
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  await db.insert(schema.auditLog).values(
    buildAudit({
      organizationId: project.organizationId,
      actorUserId: ctx.user.id,
      action: "project.closeout_dismissed",
      entityType: "project",
      entityId: projectId,
      metadata: { projectName: project.name },
    }),
  );
}

export type InvitableContact = {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  isPrimary: boolean;
  /** Portal state matched by email: none (invitable) / invited / active / disabled. */
  portal: "none" | "invited" | "active" | "disabled";
};

/** The account's contacts with portal status — feeds the invite modal (frame 35). */
export async function listInvitableContacts(ctx: AuthContext, orgId: string): Promise<InvitableContact[]> {
  const view = await getAccountView(ctx, orgId); // reuses the scope checks + contact union
  const db = getDb();
  const users = await db
    .select({ email: schema.users.email, status: schema.users.status })
    .from(schema.users)
    .where(and(eq(schema.users.organizationId, orgId), eq(schema.users.userType, "client")));
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.status]));
  return view.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    title: c.title,
    isPrimary: c.isPrimary,
    portal: c.email ? ((byEmail.get(c.email.toLowerCase()) as InvitableContact["portal"]) ?? "none") : "none",
  }));
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
      dataSensitivity: DEFAULT_DATA_SENSITIVITY,
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
