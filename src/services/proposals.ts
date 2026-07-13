/**
 * Proposals service — the phased sign-off system (HANDOFF-DELTA-2026-07-07).
 * N options (A–H), each lump-sum or phased; admin-set "recommended" (zero is
 * valid); one master client signature on the public page; later phases
 * activated/amended IN-APP without re-signing; plus a generated Contract/SOW
 * document — a one-time snapshot with its own draft→sent→executed lifecycle.
 *
 * Humans + deterministic math own every number (src/domain/proposal-math.ts);
 * the AI only writes prose. RBAC mirrors sales.ts: admin/account_owner manage;
 * all staff read (scoped). Public token paths: read, sign, decline. One shot.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { needsEngineeringReview } from "@/domain/sales";
import { buyingPathFrom, readinessFrom, type BuyingPathStatus, type PackageFields } from "@/domain/process";
import type { Approver, ProposalContract, ProposalPhase } from "@/domain/proposal-doc";
import {
  buildOptionShapes,
  chooseContractSourceOption,
  canAmendPhase,
  contractDefaults,
  defaultComplexity,
  defaultComplexityRationale,
  fallbackExecSummary,
  mergeContractPhases,
  nextOptionLabel,
  phaseSignature,
  buildContractPhases,
  type PathCount,
} from "@/domain/proposal-math";
import { assertSalesManager } from "@/services/sales";
import { draftProposalProse } from "@/services/ai/proposal";
import { recordAiRun } from "@/services/ai/usage";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import type { DraftUsage } from "@/services/ai/provider";

export type ProposalStatus = (typeof schema.PROPOSAL_STATUSES)[number];

export type ProposalOption = {
  id: string;
  label: string;
  name: string;
  summaryMd: string;
  timelineNote: string | null;
  priceCents: number;
  priceNote: string | null;
  phases: ProposalPhase[] | null;
  recommended: boolean;
};

export type ProposalDetail = {
  id: string;
  dealId: string;
  dealName: string;
  dealValueCents: number;
  /** Send-time solution-clarity and buying-path coaching. */
  dealStage: string | null;
  dealReadiness: number | null;
  dealBuyingPathStatus: BuyingPathStatus;
  discoveryNote: string | null;
  organizationId: string | null;
  organizationName: string;
  version: number;
  status: ProposalStatus;
  title: string;
  executiveSummaryMd: string | null;
  assumptionsMd: string | null;
  complexityScore: number | null;
  complexityRationale: string | null;
  needsReview: boolean;
  shareToken: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  respondedByName: string | null;
  responseNote: string | null;
  selectedOptionId: string | null;
  approvers: Approver[] | null;
  contract: ProposalContract | null;
  /** Chosen/recommended option's phases changed after the contract snapshot (draft only). */
  contractStale: boolean;
  options: ProposalOption[];
};

export type ProposalSummary = {
  id: string;
  version: number;
  status: ProposalStatus;
  title: string;
  complexityScore: number | null;
  needsReview: boolean;
  sentAt: Date | null;
  respondedAt: Date | null;
  selectedLabel: string | null;
};

function assertStaffScoped(ctx: AuthContext, organizationId: string | null, action: string): void {
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Wahala staff only.");
  }
  const scope = ctx.accessScope;
  // Account-less deals belong to no account — visible to all staff.
  if (scope.kind !== "all" && organizationId !== null && !scope.orgIds.includes(organizationId)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Not found.");
  }
}

async function loadProposal(proposalId: string) {
  const db = getDb();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!p) throw new StageError("NOT_FOUND", "Proposal not found.");
  return p;
}

async function loadOptions(proposalId: string): Promise<ProposalOption[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.proposalOptions)
    .where(eq(schema.proposalOptions.proposalId, proposalId))
    .orderBy(schema.proposalOptions.sortOrder);
  return rows.map((o) => ({
    id: o.id,
    label: o.label,
    name: o.name,
    summaryMd: o.summaryMd,
    timelineNote: o.timelineNote,
    priceCents: o.priceCents,
    priceNote: o.priceNote,
    phases: (o.phases as ProposalPhase[] | null) ?? null,
    recommended: o.recommended,
  }));
}

function computeContractStale(contract: ProposalContract | null, options: ProposalOption[], selectedOptionId: string | null): boolean {
  if (!contract || contract.status !== "draft") return false;
  const source = chooseContractSourceOption(options, selectedOptionId);
  if (!source) return false;
  return phaseSignature(buildContractPhases(source)) !== contract.sourceSignature;
}

// ---------------------------------------------------------------- read

export async function listProposalsForDeal(ctx: AuthContext, dealId: string): Promise<ProposalSummary[]> {
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  assertStaffScoped(ctx, deal.organizationId, "list_proposals");

  const rows = await db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.dealId, dealId))
    .orderBy(desc(schema.proposals.version));
  if (rows.length === 0) return [];

  const selectedIds = rows.map((p) => p.selectedOptionId).filter((v): v is string => !!v);
  const selected = selectedIds.length
    ? await db
        .select({ id: schema.proposalOptions.id, label: schema.proposalOptions.label })
        .from(schema.proposalOptions)
        .where(inArray(schema.proposalOptions.id, selectedIds))
    : [];
  const selectedLabel = new Map(selected.map((o) => [o.id, o.label]));

  return rows.map((p) => ({
    id: p.id,
    version: p.version,
    status: p.status,
    title: p.title,
    complexityScore: p.complexityScore,
    needsReview: needsEngineeringReview(p.complexityScore),
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    selectedLabel: p.selectedOptionId ? selectedLabel.get(p.selectedOptionId) ?? null : null,
  }));
}

/** The deal's LIVE proposal: highest version that isn't superseded. */
export async function liveProposalForDeal(ctx: AuthContext, dealId: string): Promise<ProposalSummary | null> {
  const rows = await listProposalsForDeal(ctx, dealId);
  return rows.find((p) => p.status !== "superseded") ?? null;
}

export type ProposalIndexRow = {
  id: string;
  dealId: string;
  dealName: string;
  organizationName: string;
  version: number;
  status: ProposalStatus;
  complexityScore: number | null;
  needsReview: boolean;
  /** Chosen || recommended || first option's price — the row's headline number. */
  priceCents: number;
  sentAt: Date | null;
  respondedAt: Date | null;
};

/** One row per deal with a live proposal (prototype §2) — the Proposals nav index. */
export async function listAllProposals(ctx: AuthContext): Promise<ProposalIndexRow[]> {
  if (!ctx.isStaff) throw new StageError("FORBIDDEN", "Wahala staff only.");
  const db = getDb();
  let rows = await db.select().from(schema.proposals).orderBy(desc(schema.proposals.updatedAt));
  const scope = ctx.accessScope;
  if (scope.kind !== "all") rows = rows.filter((p) => !p.organizationId || scope.orgIds.includes(p.organizationId));
  rows = rows.filter((p) => p.status !== "superseded");
  // One live proposal per deal — keep the highest version.
  const byDeal = new Map<string, (typeof rows)[number]>();
  for (const p of rows) {
    const cur = byDeal.get(p.dealId);
    if (!cur || p.version > cur.version) byDeal.set(p.dealId, p);
  }
  const live = [...byDeal.values()];
  if (live.length === 0) return [];

  const dealIds = [...new Set(live.map((p) => p.dealId))];
  const orgIds = [...new Set(live.map((p) => p.organizationId).filter((v): v is string => !!v))];
  const proposalIds = live.map((p) => p.id);
  const [dealRows, orgRows, optionRows] = await Promise.all([
    db.select({ id: schema.deals.id, name: schema.deals.name }).from(schema.deals).where(inArray(schema.deals.id, dealIds)),
    orgIds.length > 0
      ? db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))
      : Promise.resolve([] as { id: string; name: string }[]),
    db.select().from(schema.proposalOptions).where(inArray(schema.proposalOptions.proposalId, proposalIds)).orderBy(schema.proposalOptions.sortOrder),
  ]);
  const dealName = new Map(dealRows.map((d) => [d.id, d.name]));
  const orgName = new Map(orgRows.map((o) => [o.id, o.name]));
  const optionsByProposal = new Map<string, ProposalOption[]>();
  for (const o of optionRows) {
    const list = optionsByProposal.get(o.proposalId) ?? [];
    list.push({
      id: o.id,
      label: o.label,
      name: o.name,
      summaryMd: o.summaryMd,
      timelineNote: o.timelineNote,
      priceCents: o.priceCents,
      priceNote: o.priceNote,
      phases: (o.phases as ProposalPhase[] | null) ?? null,
      recommended: o.recommended,
    });
    optionsByProposal.set(o.proposalId, list);
  }

  return live
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((p) => {
      const options = optionsByProposal.get(p.id) ?? [];
      const headline = chooseContractSourceOption(options, p.selectedOptionId);
      return {
        id: p.id,
        dealId: p.dealId,
        dealName: dealName.get(p.dealId) ?? "Deal",
        organizationName: (p.organizationId ? orgName.get(p.organizationId) : null) ?? "—",
        version: p.version,
        status: p.status,
        complexityScore: p.complexityScore,
        needsReview: needsEngineeringReview(p.complexityScore),
        priceCents: headline?.priceCents ?? 0,
        sentAt: p.sentAt,
        respondedAt: p.respondedAt,
      };
    });
}

/** Count of proposals awaiting a client response — the nav badge. */
export async function countSentProposals(ctx: AuthContext): Promise<number> {
  if (!ctx.isStaff) return 0;
  const db = getDb();
  let rows = await db
    .select({ id: schema.proposals.id, organizationId: schema.proposals.organizationId })
    .from(schema.proposals)
    .where(eq(schema.proposals.status, "sent"));
  const scope = ctx.accessScope;
  if (scope.kind !== "all") rows = rows.filter((p) => !p.organizationId || scope.orgIds.includes(p.organizationId));
  return rows.length;
}

export async function getProposal(ctx: AuthContext, proposalId: string): Promise<ProposalDetail> {
  const db = getDb();
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "get_proposal");
  const [deal, org, options, discoveryPackage] = await Promise.all([
    db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) }),
    p.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, p.organizationId) }) : null,
    loadOptions(proposalId),
    db.query.discoveryPackages.findFirst({ where: eq(schema.discoveryPackages.dealId, p.dealId) }),
  ]);
  // Account-less deal: the header/public page carry the CONTACT's name instead.
  const headerContact = !org && deal?.primaryContactId
    ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) })
    : null;
  const contract = (p.contract as ProposalContract | null) ?? null;
  return {
    id: p.id,
    dealId: p.dealId,
    dealName: deal?.name ?? "Deal",
    dealValueCents: deal?.valueCents ?? 0,
    dealStage: deal?.stage ?? null,
    dealReadiness: readinessFrom((discoveryPackage?.fields ?? {}) as PackageFields),
    dealBuyingPathStatus: deal ? buyingPathFrom(deal, ((discoveryPackage?.fields ?? {}) as PackageFields).buyingPath).status : "unverified",
    discoveryNote: deal?.discoveryNote ?? null,
    organizationId: p.organizationId,
    organizationName: org?.name ?? headerContact?.name ?? "Unknown",
    version: p.version,
    status: p.status,
    title: p.title,
    executiveSummaryMd: p.executiveSummaryMd,
    assumptionsMd: p.assumptionsMd,
    complexityScore: p.complexityScore,
    complexityRationale: p.complexityRationale,
    needsReview: needsEngineeringReview(p.complexityScore),
    shareToken: p.shareToken,
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    respondedByName: p.respondedByName,
    responseNote: p.responseNote,
    selectedOptionId: p.selectedOptionId,
    approvers: (p.approvers as Approver[] | null) ?? null,
    contract,
    contractStale: computeContractStale(contract, options, p.selectedOptionId),
    options,
  };
}

// ---------------------------------------------------------------- create

async function loadDealForCreate(ctx: AuthContext, dealId: string, action: string) {
  assertSalesManager(ctx, action);
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  assertStaffScoped(ctx, deal.organizationId, action);
  return deal;
}

/** Who on the client side can sign — snapshot from the deal's primary contact. */
async function approversSnapshot(deal: typeof schema.deals.$inferSelect): Promise<Approver[]> {
  if (deal.primaryContactId) {
    const contact = await getDb().query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) });
    if (contact) return [{ name: contact.name, role: contact.title ?? "" }];
  }
  return [{ name: "Client contact", role: "" }];
}

async function nextVersionFor(dealId: string): Promise<number> {
  const prev = await getDb()
    .select({ version: schema.proposals.version })
    .from(schema.proposals)
    .where(eq(schema.proposals.dealId, dealId))
    .orderBy(desc(schema.proposals.version))
    .limit(1);
  return (prev[0]?.version ?? 0) + 1;
}

/** "+ Blank proposal" — two empty options, straight into the editor. */
export async function createBlankProposal(ctx: AuthContext, dealId: string): Promise<{ proposalId: string }> {
  const deal = await loadDealForCreate(ctx, dealId, "create_proposal");
  const db = getDb();
  const [version, approvers] = await Promise.all([nextVersionFor(dealId), approversSnapshot(deal)]);
  const proposalId = crypto.randomUUID();
  await db.batch([
    db.insert(schema.proposals).values({
      id: proposalId,
      organizationId: deal.organizationId,
      dealId,
      version,
      status: "draft",
      title: `${deal.name} — proposal`,
      complexityScore: 1,
      complexityRationale: "",
      approvers,
      createdByUserId: ctx.user.id,
    }),
    db.insert(schema.proposalOptions).values([
      { proposalId, label: "A", name: "Option A", summaryMd: "", phases: null, sortOrder: 0 },
      { proposalId, label: "B", name: "Option B", summaryMd: "", phases: [], sortOrder: 1 },
    ]),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.created",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { dealId, version, mode: "blank" },
      }),
    ),
  ]);
  return { proposalId };
}

/**
 * "◆ Rough out a draft" — the HYBRID: deterministic math computes shapes,
 * prices, phase splits, and complexity (the AI never prices); one AI call
 * writes the prose (exec summary + option names + phase names), falling back
 * to the deterministic template strings if it fails.
 */
export async function roughDraftProposal(
  ctx: AuthContext,
  dealId: string,
  input: { pathCount: PathCount; note?: string },
): Promise<{ proposalId: string; usage: DraftUsage | null }> {
  const deal = await loadDealForCreate(ctx, dealId, "rough_draft_proposal");
  const db = getDb();
  const org = deal.organizationId ? await db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }) : null;
  const [version, approvers] = await Promise.all([nextVersionFor(dealId), approversSnapshot(deal)]);

  const shapes = buildOptionShapes(input.pathCount, deal.valueCents);
  const complexityScore = defaultComplexity(deal.valueCents);
  let execSummary = fallbackExecSummary({ discoveryNote: deal.discoveryNote, dealName: deal.name, pathCount: input.pathCount, note: input.note });
  let optionNames = shapes.map((s) => s.name);
  let phaseNames = shapes.map((s) => s.phases?.map((p) => p.name) ?? null);
  let usage: DraftUsage | null = null;
  let aiFallback = false;

  try {
    const prose = await draftProposalProse(ctx, {
      orgName: org?.name ?? "the client",
      dealName: deal.name,
      discoveryNote: deal.discoveryNote,
      discoveryMd: deal.discoveryMd,
      clientMemoryMd: org?.aiContextMd ?? null,
      weightingNote: input.note ?? null,
      shapes: shapes.map((s) => ({ label: s.label, name: s.name, phased: !!s.phases, phaseCount: s.phases?.length ?? 0, timelineNote: s.timelineNote })),
    });
    execSummary = prose.output.execSummary;
    optionNames = shapes.map((s, i) => prose.output.options[i]?.name?.trim() || s.name);
    phaseNames = shapes.map((s, i) => {
      const names = prose.output.options[i]?.phaseNames;
      const want = s.phases?.length ?? 0;
      return want > 0 && names?.length === want ? names : (s.phases?.map((p) => p.name) ?? null);
    });
    usage = prose.usage;
  } catch (e) {
    aiFallback = true;
    console.error("[proposals] AI prose failed — deterministic fallback", e);
  }

  const proposalId = crypto.randomUUID();
  await db.batch([
    db.insert(schema.proposals).values({
      id: proposalId,
      organizationId: deal.organizationId,
      dealId,
      version,
      status: "draft",
      title: `${deal.name} — proposal`,
      executiveSummaryMd: execSummary,
      complexityScore,
      complexityRationale: defaultComplexityRationale(complexityScore),
      approvers,
      createdByUserId: ctx.user.id,
    }),
    db.insert(schema.proposalOptions).values(
      shapes.map((s, i) => ({
        proposalId,
        label: s.label,
        name: optionNames[i],
        summaryMd: "",
        timelineNote: s.timelineNote,
        priceCents: s.priceCents,
        phases: s.phases ? s.phases.map((p, j) => ({ ...p, name: phaseNames[i]?.[j] ?? p.name })) : null,
        recommended: false,
        sortOrder: i,
      })),
    ),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.drafted",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { dealId, version, pathCount: input.pathCount, complexityScore, aiFallback, model: usage?.model, costCents: usage?.costCents },
      }),
    ),
  ]);
  if (usage) await recordAiRun(db, { agentKey: "proposal", dealId, organizationId: deal.organizationId, ...usage });
  return { proposalId, usage };
}

// ---------------------------------------------------------------- edit (draft only)

async function loadDraft(ctx: AuthContext, proposalId: string, action: string) {
  assertSalesManager(ctx, action);
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, action);
  if (p.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft proposal can be edited.");
  return p;
}

export async function updateProposal(
  ctx: AuthContext,
  proposalId: string,
  input: { title?: string; executiveSummaryMd?: string; assumptionsMd?: string; complexityScore?: number },
): Promise<void> {
  const p = await loadDraft(ctx, proposalId, "update_proposal");
  void p;
  const patch: Partial<typeof schema.proposals.$inferInsert> = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new StageError("VALIDATION", "Title cannot be empty.");
    patch.title = t;
  }
  if (input.executiveSummaryMd !== undefined) patch.executiveSummaryMd = input.executiveSummaryMd.trim() || null;
  if (input.assumptionsMd !== undefined) patch.assumptionsMd = input.assumptionsMd.trim() || null;
  if (input.complexityScore !== undefined) {
    const c = Math.round(input.complexityScore);
    if (c < 1 || c > 5) throw new StageError("VALIDATION", "Complexity is 1–5.");
    patch.complexityScore = c;
    patch.complexityRationale = defaultComplexityRationale(c);
  }
  if (Object.keys(patch).length === 0) return;
  await getDb().update(schema.proposals).set(patch).where(eq(schema.proposals.id, proposalId));
}

function validatePhases(input: unknown): ProposalPhase[] | null {
  if (input === null) return null;
  if (!Array.isArray(input)) throw new StageError("VALIDATION", "Phases must be a list.");
  return input.map((raw) => {
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    if (!name) throw new StageError("VALIDATION", "Every phase needs a name.");
    const amountCents = Number(r.amountCents);
    const weeks = Number(r.weeks);
    if (!Number.isFinite(amountCents) || amountCents < 0) throw new StageError("VALIDATION", "Phase amounts must be ≥ 0.");
    if (!Number.isFinite(weeks) || weeks < 0) throw new StageError("VALIDATION", "Phase weeks must be ≥ 0.");
    return {
      name,
      amountCents: Math.round(amountCents),
      weeks: Math.round(weeks),
      // Statuses are runtime state (set on approval + amendments), never author input.
      status: "awaiting_amendment" as const,
      internalNote: typeof r.internalNote === "string" && r.internalNote.trim() ? r.internalNote.trim() : undefined,
    };
  });
}

export async function updateProposalOption(
  ctx: AuthContext,
  proposalId: string,
  optionId: string,
  input: { name?: string; summaryMd?: string; timelineNote?: string; priceCents?: number; priceNote?: string; phases?: ProposalPhase[] | null },
): Promise<void> {
  await loadDraft(ctx, proposalId, "update_proposal_option");
  const db = getDb();
  const patch: Partial<typeof schema.proposalOptions.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new StageError("VALIDATION", "Option name cannot be empty.");
    patch.name = n;
  }
  if (input.summaryMd !== undefined) patch.summaryMd = input.summaryMd;
  if (input.timelineNote !== undefined) patch.timelineNote = input.timelineNote.trim() || null;
  if (input.priceCents !== undefined) patch.priceCents = Math.max(0, Math.round(input.priceCents));
  if (input.priceNote !== undefined) patch.priceNote = input.priceNote.trim() || null;
  if (input.phases !== undefined) patch.phases = validatePhases(input.phases);
  if (Object.keys(patch).length === 0) return;
  const [row] = await db
    .update(schema.proposalOptions)
    .set(patch)
    .where(and(eq(schema.proposalOptions.id, optionId), eq(schema.proposalOptions.proposalId, proposalId)))
    .returning({ id: schema.proposalOptions.id });
  if (!row) throw new StageError("NOT_FOUND", "Option not found on this proposal.");
}

/** Prototype toggle semantics: clicking the recommended option un-marks it (zero is valid). */
export async function setRecommendedOption(ctx: AuthContext, proposalId: string, optionId: string): Promise<void> {
  await loadDraft(ctx, proposalId, "set_recommended_option");
  const db = getDb();
  const target = await db.query.proposalOptions.findFirst({
    where: and(eq(schema.proposalOptions.id, optionId), eq(schema.proposalOptions.proposalId, proposalId)),
  });
  if (!target) throw new StageError("NOT_FOUND", "Option not found on this proposal.");
  if (target.recommended) {
    await db.update(schema.proposalOptions).set({ recommended: false }).where(eq(schema.proposalOptions.id, optionId));
    return;
  }
  await db.batch([
    db.update(schema.proposalOptions).set({ recommended: false }).where(eq(schema.proposalOptions.proposalId, proposalId)),
    db.update(schema.proposalOptions).set({ recommended: true }).where(eq(schema.proposalOptions.id, optionId)),
  ]);
}

export async function addProposalOption(ctx: AuthContext, proposalId: string): Promise<{ optionId: string }> {
  await loadDraft(ctx, proposalId, "add_proposal_option");
  const db = getDb();
  const existing = await loadOptions(proposalId);
  const label = nextOptionLabel(existing.map((o) => o.label));
  if (!label) throw new StageError("VALIDATION", "Eight options is the ceiling — trim before adding more.");
  const optionId = crypto.randomUUID();
  await db.insert(schema.proposalOptions).values({
    id: optionId,
    proposalId,
    label,
    name: `Option ${label}`,
    summaryMd: "",
    phases: [],
    recommended: false, // never default recommended (§3.2)
    sortOrder: existing.length,
  });
  return { optionId };
}

export async function removeProposalOption(ctx: AuthContext, proposalId: string, optionId: string): Promise<void> {
  await loadDraft(ctx, proposalId, "remove_proposal_option");
  const db = getDb();
  const existing = await loadOptions(proposalId);
  if (existing.length <= 1) throw new StageError("VALIDATION", "A proposal needs at least one option.");
  if (!existing.some((o) => o.id === optionId)) throw new StageError("NOT_FOUND", "Option not found on this proposal.");
  await db.delete(schema.proposalOptions).where(and(eq(schema.proposalOptions.id, optionId), eq(schema.proposalOptions.proposalId, proposalId)));
}

/**
 * Delete — draft/sent only. An approved proposal is the commercial record behind
 * a Committed deal (and possibly an executed contract); declined ones feed
 * post-mortems. Sent-delete is the "sent by mistake" escape hatch.
 */
export async function deleteProposal(ctx: AuthContext, proposalId: string): Promise<void> {
  assertSalesManager(ctx, "delete_proposal");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "delete_proposal");
  if (p.status !== "draft" && p.status !== "sent") {
    throw new StageError("INVALID_STATE", "Only a draft or sent proposal can be deleted — this one is part of the deal's record.");
  }
  const db = getDb();
  await db.batch([
    db.delete(schema.proposalOptions).where(eq(schema.proposalOptions.proposalId, proposalId)),
    db.delete(schema.proposals).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.deleted",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { dealId: p.dealId, version: p.version, status: p.status },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------- send / respond

/**
 * Send: EVERY option must be priced; generates the public share token; supersedes
 * every other open (draft/sent) proposal on the deal; nudges the deal's disposition
 * to 'proposal_out'. Complexity >3 is a SOFT flag — the UI confirms, never blocks.
 */
export async function sendProposal(ctx: AuthContext, proposalId: string): Promise<{ shareToken: string; movedToProposalOut: boolean }> {
  assertSalesManager(ctx, "send_proposal");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "send_proposal");
  if (p.status !== "draft") throw new StageError("INVALID_STATE", `Cannot send a ${p.status} proposal.`);

  const options = await loadOptions(proposalId);
  if (options.length < 1) throw new StageError("VALIDATION", "A proposal needs at least one option before it goes out.");
  if (options.some((o) => o.priceCents <= 0)) {
    throw new StageError("VALIDATION", "Price every option before sending — the AI never prices, a human must.");
  }

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) });
  const shareToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const now = new Date();

  const others = await db
    .select({ id: schema.proposals.id })
    .from(schema.proposals)
    .where(and(eq(schema.proposals.dealId, p.dealId), inArray(schema.proposals.status, ["draft", "sent"])));
  const otherIds = others.map((o) => o.id).filter((oid) => oid !== proposalId);

  const statements: BatchItem<"sqlite">[] = [
    db.update(schema.proposals).set({ status: "sent", shareToken, sentAt: now }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.sent",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { version: p.version, complexityScore: p.complexityScore, superseded: otherIds.length },
      }),
    ),
  ];
  if (otherIds.length > 0) {
    statements.push(
      db.update(schema.proposals).set({ status: "superseded" }).where(inArray(schema.proposals.id, otherIds)),
    );
  }
  // Stage follows the proposal (09 Jul b): sending IS the advance — one event,
  // one transaction. There is no manual move out of Discovery anymore.
  const movedToProposalOut = !!deal && (deal.stage === "discovery" || deal.stage === "new");
  if (deal && movedToProposalOut) {
    statements.push(
      db.update(schema.deals).set({ stage: "proposal_out", stageEnteredAt: now, subStatus: null }).where(eq(schema.deals.id, deal.id)),
      db.insert(schema.auditLog).values(
        buildAudit({
          organizationId: p.organizationId,
          actorUserId: ctx.user.id,
          action: "deal.stage_changed",
          entityType: "deal",
          entityId: deal.id,
          metadata: { from: deal.stage, to: "proposal_out", via: "proposal.sent" },
        }),
      ),
    );
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
  return { shareToken, movedToProposalOut };
}

/** Shared approve/decline bookkeeping used by both the public link and staff recording. */
async function applyResponse(
  p: typeof schema.proposals.$inferSelect,
  input: {
    outcome: "approved" | "declined";
    optionId?: string;
    respondedByName: string;
    responseNote?: string;
    actorUserId: string | null;
  },
): Promise<void> {
  const db = getDb();
  if (p.status !== "sent") throw new StageError("INVALID_STATE", "This proposal is not open for a response.");

  let selectedOptionId: string | null = null;
  let firstPhaseActivated = false;
  const options = await loadOptions(p.id);
  if (input.outcome === "approved") {
    if (!input.optionId) throw new StageError("VALIDATION", "Pick an option to approve.");
    if (!options.some((o) => o.id === input.optionId)) {
      throw new StageError("VALIDATION", "That option does not belong to this proposal.");
    }
    selectedOptionId = input.optionId;
  }

  const now = new Date();
  const statements: BatchItem<"sqlite">[] = [
    db
      .update(schema.proposals)
      .set({
        status: input.outcome,
        respondedAt: now,
        respondedByName: input.respondedByName.trim() || null,
        responseNote: input.responseNote?.trim() || null,
        selectedOptionId,
      })
      .where(eq(schema.proposals.id, p.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: input.actorUserId,
        action: input.outcome === "approved" ? "proposal.approved" : "proposal.declined",
        entityType: "proposal",
        entityId: p.id,
        metadata: { version: p.version, respondedByName: input.respondedByName, optionId: selectedOptionId },
      }),
    ),
  ];

  // The master signature activates the engagement: Phase 1 of the signed option
  // goes ACTIVE; later phases stay dormant until amended in-app (§3.3).
  if (input.outcome === "approved" && selectedOptionId) {
    const chosen = options.find((o) => o.id === selectedOptionId);
    if (chosen?.phases?.length) {
      const phases = chosen.phases.map((ph, i) => (i === 0 ? { ...ph, status: "active" as const } : ph));
      statements.push(db.update(schema.proposalOptions).set({ phases }).where(eq(schema.proposalOptions.id, selectedOptionId)));
      firstPhaseActivated = true;
    }
  }

  // Approval = the client committed. The deal moves to Committed ("the Contract
  // room" — delta §3.3), where the agreement package + deposit gate the handoff.
  let movedToCommitted = false;
  if (input.outcome === "approved") {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) });
    if (deal && !["committed", "won", "lost"].includes(deal.stage)) {
      movedToCommitted = true;
      statements.push(
        db.update(schema.deals).set({ stage: "committed", stageEnteredAt: now, subStatus: null }).where(eq(schema.deals.id, deal.id)),
        db.insert(schema.auditLog).values(
          buildAudit({
            organizationId: p.organizationId,
            actorUserId: input.actorUserId,
            action: "deal.stage_changed",
            entityType: "deal",
            entityId: deal.id,
            metadata: { from: deal.stage, to: "committed", via: "proposal.approved", firstPhaseActivated },
          }),
        ),
      );
    }
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);

  // QA delta 07-08 (prototype note): entering Committed via a signature must seed
  // the agreement/deposit checklist too, or the drawer's Create-project path is a
  // dead end for non-seeded deals. Same idempotent seeding setDealStage does.
  if (movedToCommitted) {
    const { seedDealPackage } = await import("@/services/agreements");
    await seedDealPackage(p.organizationId, p.dealId);
  }
}

/** Staff records a response received outside the app (call, email, meeting). */
export async function recordProposalResponse(
  ctx: AuthContext,
  proposalId: string,
  input: { outcome: "approved" | "declined"; optionId?: string; respondedByName?: string; responseNote?: string },
): Promise<void> {
  assertSalesManager(ctx, "record_proposal_response");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "record_proposal_response");
  await applyResponse(p, {
    outcome: input.outcome,
    optionId: input.optionId,
    respondedByName: input.respondedByName?.trim() || ctx.user.name,
    responseNote: input.responseNote,
    actorUserId: ctx.user.id,
  });
}

// ---------------------------------------------------------------- phase amendments

/**
 * "Activate & amend" — the phased sign-off mechanic (§3, the product's main
 * differentiator): once the master signature is on file, each later phase is
 * confirmed IN-APP, no new signature. Strict preconditions; audited.
 */
export async function amendPhase(ctx: AuthContext, proposalId: string, phaseIndex: number): Promise<void> {
  assertSalesManager(ctx, "amend_phase");
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, "amend_phase");
  if (p.status !== "approved") throw new StageError("INVALID_STATE", "Phases activate only after the master signature is on file.");
  if (!p.selectedOptionId) throw new StageError("INVALID_STATE", "No signed option on this proposal.");
  const options = await loadOptions(proposalId);
  const chosen = options.find((o) => o.id === p.selectedOptionId);
  if (!chosen?.phases?.length) throw new StageError("INVALID_STATE", "The signed option isn't phased.");
  if (!canAmendPhase(chosen.phases, phaseIndex)) {
    throw new StageError("INVALID_STATE", "That phase can't be activated yet — the previous phase must be active or done first.");
  }
  const phases = chosen.phases.map((ph, i) =>
    i === phaseIndex ? { ...ph, status: "active" as const } : i === phaseIndex - 1 ? { ...ph, status: "done" as const } : ph,
  );
  const db = getDb();
  await db.batch([
    db.update(schema.proposalOptions).set({ phases }).where(eq(schema.proposalOptions.id, chosen.id)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.phase_amended",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { optionId: chosen.id, phaseIndex, phaseName: phases[phaseIndex].name, previousPhaseName: phases[phaseIndex - 1]?.name },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------- contract / SOW

async function loadForContract(ctx: AuthContext, proposalId: string, action: string) {
  assertSalesManager(ctx, action);
  const p = await loadProposal(proposalId);
  assertStaffScoped(ctx, p.organizationId, action);
  return p;
}

/** One-time snapshot of the chosen (|| recommended || first) option. Idempotent. */
export async function generateContract(ctx: AuthContext, proposalId: string): Promise<ProposalContract> {
  const p = await loadForContract(ctx, proposalId, "generate_contract");
  const existing = (p.contract as ProposalContract | null) ?? null;
  if (existing) return existing;
  const options = await loadOptions(proposalId);
  const source = chooseContractSourceOption(options, p.selectedOptionId);
  if (!source) throw new StageError("INVALID_STATE", "The proposal has no options to contract against.");
  const contract = contractDefaults({
    dealId: p.dealId,
    complexityScore: p.complexityScore ?? 1,
    option: source,
    approvers: (p.approvers as Approver[] | null) ?? null,
    generatedAt: new Date().toISOString(),
  });
  const db = getDb();
  await db.batch([
    db.update(schema.proposals).set({ contract }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.contract_generated",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { proposalNumber: contract.proposalNumber, sourceOptionId: contract.sourceOptionId, phases: contract.phases.length },
      }),
    ),
  ]);
  return contract;
}

type ContractPatch = Partial<
  Pick<
    ProposalContract,
    | "scopeOfEngagement"
    | "phases"
    | "depositPct"
    | "outOfScopeEnabled"
    | "outOfScopeText"
    | "changeManagementEnabled"
    | "changeManagementText"
    | "acceptanceReviewDays"
    | "clientSignerName"
    | "clientSignerTitle"
    | "ourSignerName"
    | "ourSignerTitle"
  >
>;

/** Autosave edits — contract must exist and be DRAFT (sent/executed are locked). */
export async function updateContract(ctx: AuthContext, proposalId: string, patch: ContractPatch): Promise<void> {
  const p = await loadForContract(ctx, proposalId, "update_contract");
  const contract = (p.contract as ProposalContract | null) ?? null;
  if (!contract) throw new StageError("NOT_FOUND", "No contract on this proposal yet.");
  if (contract.status !== "draft") throw new StageError("INVALID_STATE", "The contract is locked — revert to draft to edit it.");

  const next: ProposalContract = { ...contract };
  if (patch.scopeOfEngagement !== undefined) next.scopeOfEngagement = String(patch.scopeOfEngagement);
  if (patch.phases !== undefined) {
    if (!Array.isArray(patch.phases) || patch.phases.length === 0) throw new StageError("VALIDATION", "The contract needs at least one phase.");
    next.phases = patch.phases.map((ph) => ({
      name: String(ph.name ?? "").trim() || "Phase",
      amountCents: Math.max(0, Math.round(Number(ph.amountCents) || 0)),
      weeks: ph.weeks === null ? null : Math.max(0, Math.round(Number(ph.weeks) || 0)),
      objective: String(ph.objective ?? ""),
      scopeText: String(ph.scopeText ?? ""),
      deliverablesText: String(ph.deliverablesText ?? ""),
      acceptanceText: String(ph.acceptanceText ?? ""),
    }));
  }
  if (patch.depositPct !== undefined) {
    const pct = Math.round(Number(patch.depositPct));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new StageError("VALIDATION", "Deposit is 0–100%.");
    next.depositPct = pct;
  }
  if (patch.outOfScopeEnabled !== undefined) next.outOfScopeEnabled = !!patch.outOfScopeEnabled;
  if (patch.outOfScopeText !== undefined) next.outOfScopeText = String(patch.outOfScopeText);
  if (patch.changeManagementEnabled !== undefined) next.changeManagementEnabled = !!patch.changeManagementEnabled;
  if (patch.changeManagementText !== undefined) next.changeManagementText = String(patch.changeManagementText);
  if (patch.acceptanceReviewDays !== undefined) {
    const d = Math.round(Number(patch.acceptanceReviewDays));
    if (!Number.isFinite(d) || d < 1 || d > 60) throw new StageError("VALIDATION", "Review window is 1–60 days.");
    next.acceptanceReviewDays = d;
  }
  for (const k of ["clientSignerName", "clientSignerTitle", "ourSignerName", "ourSignerTitle"] as const) {
    if (patch[k] !== undefined) next[k] = String(patch[k]);
  }
  await getDb().update(schema.proposals).set({ contract: next }).where(eq(schema.proposals.id, proposalId));
}

/** Draft → sent → executed; sent → draft is the only way back. Executed is terminal. */
export async function setContractStatus(ctx: AuthContext, proposalId: string, to: "draft" | "sent" | "executed"): Promise<void> {
  const p = await loadForContract(ctx, proposalId, "set_contract_status");
  const contract = (p.contract as ProposalContract | null) ?? null;
  if (!contract) throw new StageError("NOT_FOUND", "No contract on this proposal yet.");
  const ok =
    (contract.status === "draft" && to === "sent") ||
    (contract.status === "sent" && to === "executed") ||
    (contract.status === "sent" && to === "draft");
  if (!ok) throw new StageError("INVALID_STATE", `Cannot move a ${contract.status} contract to ${to}.`);
  const db = getDb();
  await db.batch([
    db.update(schema.proposals).set({ contract: { ...contract, status: to } }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.contract_status",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { from: contract.status, to, proposalNumber: contract.proposalNumber },
      }),
    ),
  ]);
  // The doc drives the package row — sent/executed flow through, never backwards.
  if (to === "sent" || to === "executed") {
    const { syncCommercialRowFromContract } = await import("@/services/agreements");
    await syncCommercialRowFromContract(ctx.user.id, p.organizationId, p.dealId, to);
  }
}

/** Rebuild phases from the live option, preserving written text by phase name. Draft only. */
export async function resyncContract(ctx: AuthContext, proposalId: string): Promise<void> {
  const p = await loadForContract(ctx, proposalId, "resync_contract");
  const contract = (p.contract as ProposalContract | null) ?? null;
  if (!contract) throw new StageError("NOT_FOUND", "No contract on this proposal yet.");
  if (contract.status !== "draft") throw new StageError("INVALID_STATE", "Only a draft contract resyncs — sent/executed documents own their numbers.");
  const options = await loadOptions(proposalId);
  const source = chooseContractSourceOption(options, p.selectedOptionId);
  if (!source) throw new StageError("INVALID_STATE", "The proposal has no options.");
  const phases = mergeContractPhases(contract.phases, source);
  const next: ProposalContract = {
    ...contract,
    phases,
    sourceOptionId: source.id,
    // Must match what computeContractStale compares against (built phases).
    sourceSignature: phaseSignature(buildContractPhases(source)),
  };
  const db = getDb();
  await db.batch([
    db.update(schema.proposals).set({ contract: next }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.contract_resynced",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { sourceOptionId: source.id, phases: phases.length },
      }),
    ),
  ]);
}

/** A real change order is a new logged entry, never a silent edit. Executed only. */
export async function addContractAmendment(ctx: AuthContext, proposalId: string, note: string): Promise<void> {
  const p = await loadForContract(ctx, proposalId, "add_contract_amendment");
  const contract = (p.contract as ProposalContract | null) ?? null;
  if (!contract) throw new StageError("NOT_FOUND", "No contract on this proposal yet.");
  if (contract.status !== "executed") throw new StageError("INVALID_STATE", "Amendments log against an executed contract.");
  const trimmed = note.trim();
  if (!trimmed) throw new StageError("VALIDATION", "Write the amendment first.");
  const next: ProposalContract = { ...contract, amendments: [...contract.amendments, { note: trimmed, at: new Date().toISOString() }] };
  const db = getDb();
  await db.batch([
    db.update(schema.proposals).set({ contract: next }).where(eq(schema.proposals.id, proposalId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: p.organizationId,
        actorUserId: ctx.user.id,
        action: "proposal.contract_amended",
        entityType: "proposal",
        entityId: proposalId,
        metadata: { note: trimmed.slice(0, 200), count: next.amendments.length },
      }),
    ),
  ]);
}

// ---------------------------------------------------------------- public (share link)

export type PublicProposal = {
  organizationName: string;
  version: number;
  status: ProposalStatus;
  title: string;
  executiveSummaryMd: string | null;
  assumptionsMd: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  respondedByName: string | null;
  selectedOptionId: string | null;
  options: ProposalOption[];
};

/** Read a proposal by its share token — only sent/approved/declined are visible. */
export async function getProposalByToken(token: string): Promise<PublicProposal | null> {
  if (!token || token.length < 32) return null;
  const db = getDb();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.shareToken, token) });
  if (!p || p.status === "draft" || p.status === "superseded") return null;
  const [org, options] = await Promise.all([
    p.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, p.organizationId) }) : null,
    loadOptions(p.id),
  ]);
  // Account-less deal: "prepared for" carries the CONTACT's name (the person IS the record).
  let contactName: string | null = null;
  if (!org) {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, p.dealId) });
    const contact = deal?.primaryContactId ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null;
    contactName = contact?.name ?? null;
  }
  return {
    organizationName: org?.name ?? contactName ?? "your team",
    version: p.version,
    status: p.status,
    title: p.title,
    executiveSummaryMd: p.executiveSummaryMd,
    assumptionsMd: p.assumptionsMd,
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    respondedByName: p.respondedByName,
    selectedOptionId: p.selectedOptionId,
    options,
  };
}

async function loadByToken(token: string) {
  if (!token || token.length < 32) throw new StageError("NOT_FOUND", "Proposal not found.");
  const p = await getDb().query.proposals.findFirst({ where: eq(schema.proposals.shareToken, token) });
  if (!p) throw new StageError("NOT_FOUND", "Proposal not found.");
  return p;
}

/** The client signs via the share link: typed name + chosen option. One shot. */
export async function approveProposalByToken(token: string, input: { optionId: string; name: string }): Promise<void> {
  const name = input.name?.trim();
  if (!name || name.length < 2) throw new StageError("VALIDATION", "Type your name to sign.");
  const p = await loadByToken(token);
  await applyResponse(p, {
    outcome: "approved",
    optionId: input.optionId,
    respondedByName: name,
    actorUserId: null, // the prospect isn't a portal user — the typed name is the record
  });
}

/** The client declines via the share link. */
export async function declineProposalByToken(token: string, input: { name?: string; note?: string }): Promise<void> {
  const p = await loadByToken(token);
  await applyResponse(p, {
    outcome: "declined",
    respondedByName: input.name?.trim() || "Client (via share link)",
    responseNote: input.note,
    actorUserId: null,
  });
}
