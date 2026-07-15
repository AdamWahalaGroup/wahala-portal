/**
 * Contract room (see docs/SALES-PROCESS.md). "The contract is a phase,
 * not a single object": once a proposal is approved, this is where the commercials
 * checklist (MSA, NDA, insurance) gets tracked, the client contact gets a portal
 * account, and the contract EXECUTES — the AI writes the SOW as a real project
 * (phases + focus-area deliverables, no prices) and the deal is won. From there the
 * existing delivery machine takes over: quote phase 1, client approves, pay-gate.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { chooseContractSourceOption, deriveProjectPhases, type DerivedPhase } from "@/domain/proposal-math";
import { assertCanManageDeal, assertDealSeller, setDealStage } from "@/services/sales";
import { listForDeal, type AgreementRow } from "@/services/agreements";
import { draftProject } from "@/services/ai/draft-project";
import { createDraftedProject } from "@/services/projects";
import { buildAudit } from "@/services/audit";
import { createMagicToken } from "@/auth/magic-link";
import { sendInviteEmail } from "@/auth/email";
import { isDevAuth } from "@/auth/server-env";
import type { DraftUsage } from "@/services/ai/provider";
import { recordAiRun } from "@/services/ai/usage";
import type { ProposalContract } from "@/domain/proposal-doc";

export type ContractRoom = {
  available: boolean; // an approved proposal exists (or the deal already reached committed/won)
  /** The agreement package: account-level MSA/NDA + this deal's docs. */
  agreements: AgreementRow[];
  msaOnFile: boolean;
  deposit: { cents: number; sentAt: Date | null; paidAt: Date | null };
  approvedProposal: {
    id: string;
    title: string;
    optionLabel: string | null;
    optionName: string | null;
    priceCents: number | null;
    timelineNote: string | null;
  } | null;
  clientInvited: boolean; // the org already has at least one client user
  contactEmail: string | null;
  contactName: string | null;
  project: { id: string; name: string } | null;
  /** The phase skeleton the project will be born with — derived, never seeded. */
  phases: DerivedPhase[];
};

async function loadDealScoped(ctx: AuthContext, dealId: string) {
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (
    !ctx.isStaff ||
    (ctx.user.role === "sales_rep" && deal.ownerUserId !== ctx.user.id) ||
    (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId))
  ) {
    throw new StageError("NOT_FOUND", "Deal not found.");
  }
  return deal;
}

async function approvedProposalFor(dealId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.proposals)
    .where(and(eq(schema.proposals.dealId, dealId), eq(schema.proposals.status, "approved")));
  return rows[0] ?? null;
}

export async function getContractRoom(ctx: AuthContext, dealId: string): Promise<ContractRoom> {
  const db = getDb();
  const deal = await loadDealScoped(ctx, dealId);
  const approved = await approvedProposalFor(dealId);
  const available = !!approved || ["committed", "won"].includes(deal.stage);

  const [pkg, clientUsers, contact, project, options] = await Promise.all([
    deal.organizationId ? listForDeal(ctx, deal.organizationId, dealId) : Promise.resolve({ rows: [] as AgreementRow[], msaOnFile: false }),
    deal.organizationId
      ? db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.organizationId, deal.organizationId), eq(schema.users.userType, "client")))
      : Promise.resolve([] as { id: string }[]),
    deal.primaryContactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null,
    deal.projectId ? db.query.projects.findFirst({ where: eq(schema.projects.id, deal.projectId) }) : null,
    approved
      ? db.select().from(schema.proposalOptions).where(eq(schema.proposalOptions.proposalId, approved.id))
      : ([] as (typeof schema.proposalOptions.$inferSelect)[]),
  ]);
  const selectedOption = approved?.selectedOptionId ? options.find((o) => o.id === approved.selectedOptionId) : null;

  return {
    available,
    agreements: pkg.rows,
    msaOnFile: pkg.msaOnFile,
    deposit: { cents: deal.depositCents, sentAt: deal.depositSentAt, paidAt: deal.depositPaidAt },
    approvedProposal: approved
      ? {
          id: approved.id,
          title: approved.title,
          optionLabel: selectedOption?.label ?? null,
          optionName: selectedOption?.name ?? null,
          priceCents: selectedOption?.priceCents ?? null,
          timelineNote: selectedOption?.timelineNote ?? null,
        }
      : null,
    clientInvited: clientUsers.length > 0,
    contactEmail: contact?.email ?? null,
    contactName: contact?.name ?? null,
    project: project ? { id: project.id, name: project.name } : null,
    phases: deriveProjectPhases(options, approved?.selectedOptionId ?? null, deal.valueCents),
  };
}

/**
 * Give the deal's primary contact a portal account on the (existing) prospect org
 * and send the magic-link invite — "create customer account" from the contract
 * phase. Idempotent-ish: refuses if the email already has a user.
 */
export async function inviteContactToOrg(
  ctx: AuthContext,
  dealId: string,
  origin: string,
): Promise<{ userId: string; inviteLink?: string }> {
  assertDealSeller(ctx, "invite_contact");
  const deal = await loadDealScoped(ctx, dealId);
  assertCanManageDeal(ctx, deal, "invite_contact");
  if (!deal.organizationId) {
    throw new StageError("VALIDATION", "This deal has no account yet — it's created at Create project →, and the invite follows it.");
  }
  const db = getDb();
  const contact = deal.primaryContactId
    ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) })
    : null;
  if (!contact?.email) {
    throw new StageError("VALIDATION", "The deal's primary contact has no email — add one to the contact first.");
  }
  const email = contact.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) throw new StageError("VALIDATION", "A user with that email already exists.");

  const userId = crypto.randomUUID();
  await db.batch([
    db.insert(schema.users).values({
      id: userId,
      organizationId: deal.organizationId,
      userType: "client",
      role: "client_admin",
      name: contact.name,
      email,
      status: "invited",
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "contract.client_invited",
        entityType: "deal",
        entityId: dealId,
        metadata: { email, contactName: contact.name },
      }),
    ),
  ]);

  const token = await createMagicToken({ userId, email });
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) });
  const url = new URL(`/api/auth/verify?token=${token}`, origin).toString();
  let inviteLink: string | undefined;
  if (isDevAuth()) {
    inviteLink = url;
    console.log(`[invite] ${email}: ${url}`);
  } else {
    try {
      await sendInviteEmail(email, url, org?.name ?? "Wahala Group");
    } catch (err) {
      console.error("[invite] email send failed:", err);
    }
  }
  return { userId, inviteLink };
}

/**
 * EXECUTE the contract — the R4 seam. Requires an approved proposal. The AI writes
 * the SOW as a ProjectDraft (phases + focus-area deliverables + acceptance-style
 * descriptions, NO prices) grounded on the chosen option + discovery + memory, then
 * createDraftedProject turns it into the real project and the deal is WON (org →
 * active, discovery graduates into client memory). Pricing happens next on phase 1
 * via the existing quote flow — the pay-gates stay exactly where they were.
 */
export async function executeContract(
  ctx: AuthContext,
  dealId: string,
  opts: { force?: boolean } = {},
): Promise<{ projectId: string; stagesCreated: number; usage: DraftUsage }> {
  assertDealSeller(ctx, "execute_contract");
  let deal = await loadDealScoped(ctx, dealId);
  assertCanManageDeal(ctx, deal, "execute_contract");
  if (ctx.user.role === "sales_rep") {
    throw new StageError("FORBIDDEN", "An account owner or Wahala admin must create the delivery Project.");
  }
  if (deal.projectId) throw new StageError("INVALID_STATE", "This deal already created its project.");
  const approved = await approvedProposalFor(dealId);
  // A deal that reached Committed must always be able to finish the loop — an
  // approved proposal makes the SOW richer, it isn't a precondition (prototype 07-08:
  // no proposal means the project is born as one phase at the deal value).
  if (!approved && !["committed", "won"].includes(deal.stage)) {
    throw new StageError("INVALID_STATE", "Create project needs an approved proposal or a deal in Contracting.");
  }
  // "Deposit clears → project": the one money-gate on the sales side. Admins may
  // force (logged via the normal audit trail); everyone else waits for the deposit.
  if (!deal.depositPaidAt && !(opts.force && ctx.isAdmin)) {
    throw new StageError("PAY_GATE", "The deposit hasn't cleared — mark it paid first (admins can force).");
  }

  const db = getDb();

  // Account-less opportunity won (HANDOFF-DELTA-2026-07-09 §2): the account is born
  // NOW — created from the contact's name, the contact linked as primary, the deal
  // and its proposals re-linked. Nothing entered earlier is ever re-typed.
  let organizationId = deal.organizationId;
  if (!organizationId) {
    const contact = deal.primaryContactId
      ? await db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) })
      : null;
    organizationId = crypto.randomUUID();
    const accountName = contact?.name ?? (deal.name.split("—")[0].trim() || "New client");
    const statements: unknown[] = [
      db.insert(schema.organizations).values({
        id: organizationId,
        name: accountName,
        status: "prospect",
        accountOwnerUserId: deal.ownerUserId ?? ctx.user.id,
        ownerAssignedAt: new Date(),
      }),
      db.update(schema.deals).set({ organizationId }).where(eq(schema.deals.id, dealId)),
      db.update(schema.proposals).set({ organizationId }).where(eq(schema.proposals.dealId, dealId)),
      // Backfill the deal's account-less history so org-scoped queries see it whole.
      db.update(schema.processEvents).set({ organizationId }).where(eq(schema.processEvents.dealId, dealId)),
      db.insert(schema.auditLog).values(
        buildAudit({
          organizationId,
          actorUserId: ctx.user.id,
          action: "account.born_at_win",
          entityType: "deal",
          entityId: dealId,
          metadata: { accountName, contactId: contact?.id ?? null },
        }),
      ),
    ];
    if (contact) {
      statements.push(db.update(schema.contacts).set({ organizationId }).where(eq(schema.contacts.id, contact.id)));
      statements.push(db.insert(schema.contactCompanies).values({ contactId: contact.id, organizationId, isPrimary: true }));
    }
    await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
    deal = { ...deal, organizationId };
    // The account exists now — give it the agreement package its deal already earned.
    const { seedDealPackage } = await import("@/services/agreements");
    await seedDealPackage(organizationId, dealId);
  }
  const options = approved
    ? await db.select().from(schema.proposalOptions).where(eq(schema.proposalOptions.proposalId, approved.id))
    : [];
  const chosen = approved ? chooseContractSourceOption(options, approved.selectedOptionId) : undefined;
  const approvedContract = (approved?.contract as ProposalContract | null | undefined) ?? null;
  // "Right names, right amounts": the phase skeleton comes from the signed proposal
  // (or, without one, the deal itself). The AI writes scope + deliverables into it.
  const phases = deriveProjectPhases(options, approved?.selectedOptionId ?? null, deal.valueCents);

  // The SOW sources: the approved commercial shape + everything discovery captured.
  const sources: string[] = [
    approved ? `APPROVED PROPOSAL (v${approved.version}): ${approved.title}` : "",
    approved?.executiveSummaryMd ?? "",
    chosen ? `CHOSEN OPTION ${chosen.label}: ${chosen.name}\n${chosen.summaryMd}${chosen.timelineNote ? `\nTimeline: ${chosen.timelineNote}` : ""}` : "",
    approvedContract
      ? `ACCEPTED CONTRACT / STATEMENT OF WORK\n${approvedContract.phases.map((phase, index) => [
          `PHASE ${index + 1}: ${phase.name}`,
          `Objective: ${phase.objective}`,
          `Scope:\n${phase.scopeText}`,
          `Deliverables:\n${phase.deliverablesText}`,
          `Acceptance:\n${phase.acceptanceText}`,
        ].join("\n")).join("\n\n")}`
      : "",
    approvedContract?.outOfScopeEnabled ? `OUT OF SCOPE\n${approvedContract.outOfScopeText}` : "",
    approved?.assumptionsMd ? `PROPOSAL ASSUMPTIONS\n${approved.assumptionsMd}` : "",
    deal.discoveryMd ? `DISCOVERY PACKAGE\n${deal.discoveryMd}` : "",
    deal.notes ? `DEAL NOTES\n${deal.notes}` : "",
    `INSTRUCTION: The statement of work has exactly ${phases.length} phase${phases.length === 1 ? "" : "s"}, in this order: ${phases
      .map((p, i) => `${i + 1}. ${p.name}`)
      .join("; ")}. Write scope and deliverables for these named phases only — do not invent, rename, split, or merge phases, and do not include work that belongs to an option that was not chosen. Commercial amounts are handled elsewhere.`,
  ].filter(Boolean);

  const { draft, usage } = await draftProject(ctx, {
    organizationId,
    files: [],
    pastedText: sources.join("\n\n---\n\n"),
  });
  await recordAiRun(db, { agentKey: "project_draft", dealId: deal.id, organizationId, ...usage });

  // Force the skeleton: names + amounts from the proposal, deliverables from the AI
  // (merged by position; a single-phase deal absorbs everything the AI drafted).
  const stages = phases.map((ph, i) => {
    const src = phases.length === 1 ? draft.stages : draft.stages[i] ? [draft.stages[i]] : [];
    return {
      name: ph.name,
      scopeDescription: src.map((s) => s.scopeDescription).filter(Boolean).join("\n\n") || undefined,
      deliverables: src.flatMap((s) => s.deliverables),
      totalAmountCents: ph.amountCents,
    };
  });

  const { projectId } = await createDraftedProject(ctx, {
    organizationId,
    name: draft.name,
    description: draft.description,
    workType: draft.workType,
    aiContextMd: draft.projectContextMd,
    stages,
    clientMessage: draft.clientMessage,
    postToThread: true,
  });

  // "Deposit = Stage 1's payment": when the deposit cleared, Stage 1 is born PAID —
  // the deposit invoice is its payment record. Stages 2+ follow the normal pay-gate.
  if (deal.depositPaidAt) {
    const firstStage = await db.query.stages.findFirst({
      where: eq(schema.stages.projectId, projectId),
      orderBy: schema.stages.sequence,
    });
    if (firstStage) {
      await db.batch([
        db
          .update(schema.stages)
          .set({
            status: "paid",
            // The phase keeps its proposal amount; the deposit is its payment record.
            ...(firstStage.totalAmountCents > 0 ? {} : { totalAmountCents: deal.depositCents }),
            quoteApprovedAt: deal.depositPaidAt,
            approvedByUserId: ctx.user.id,
            paidAt: deal.depositPaidAt,
          })
          .where(eq(schema.stages.id, firstStage.id)),
        db.insert(schema.auditLog).values(
          buildAudit({
            organizationId: deal.organizationId,
            actorUserId: ctx.user.id,
            action: "stage.paid",
            entityType: "stage",
            entityId: firstStage.id,
            metadata: { via: "deal_deposit", dealId, amountCents: deal.depositCents },
          }),
        ),
      ]);
    }
  }

  await db.batch([
    db.update(schema.deals).set({ projectId }).where(eq(schema.deals.id, dealId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "contract.executed",
        entityType: "deal",
        entityId: dealId,
        metadata: { projectId, proposalId: approved?.id ?? null, model: usage.model, costCents: usage.costCents },
      }),
    ),
  ]);

  // Signed contract == the prospect became a customer. Won handles org activation
  // + discovery→memory graduation and is idempotent-safe on stage.
  if (deal.stage !== "won") await setDealStage(ctx, dealId, "won");

  return { projectId, stagesCreated: draft.stages.length, usage };
}
