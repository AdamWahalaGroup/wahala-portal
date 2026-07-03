/**
 * Contract room (R4 — docs/brain_storming/synthesis.md). "The contract is a phase,
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
import { assertSalesManager, setDealStage } from "@/services/sales";
import { listForDeal, type AgreementRow } from "@/services/agreements";
import { draftProject } from "@/services/ai/draft-project";
import { createDraftedProject } from "@/services/projects";
import { buildAudit } from "@/services/audit";
import { createMagicToken } from "@/auth/magic-link";
import { sendInviteEmail } from "@/auth/email";
import { isDevAuth } from "@/auth/server-env";
import type { DraftUsage } from "@/services/ai/provider";

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
};

async function loadDealScoped(ctx: AuthContext, dealId: string) {
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (!ctx.isStaff || (scope.kind !== "all" && !scope.orgIds.includes(deal.organizationId))) {
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

  const [pkg, clientUsers, contact, project, selectedOption] = await Promise.all([
    listForDeal(ctx, deal.organizationId, dealId),
    db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.organizationId, deal.organizationId), eq(schema.users.userType, "client"))),
    deal.primaryContactId ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) }) : null,
    deal.projectId ? db.query.projects.findFirst({ where: eq(schema.projects.id, deal.projectId) }) : null,
    approved?.selectedOptionId
      ? db.query.proposalOptions.findFirst({ where: eq(schema.proposalOptions.id, approved.selectedOptionId) })
      : null,
  ]);

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
  assertSalesManager(ctx, "invite_contact");
  const deal = await loadDealScoped(ctx, dealId);
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
): Promise<{ projectId: string; usage: DraftUsage }> {
  assertSalesManager(ctx, "execute_contract");
  const deal = await loadDealScoped(ctx, dealId);
  if (deal.projectId) throw new StageError("INVALID_STATE", "This deal already created its project.");
  const approved = await approvedProposalFor(dealId);
  if (!approved) throw new StageError("INVALID_STATE", "Create project needs an approved proposal first.");
  // "Deposit clears → project": the one money-gate on the sales side. Admins may
  // force (logged via the normal audit trail); everyone else waits for the deposit.
  if (!deal.depositPaidAt && !(opts.force && ctx.isAdmin)) {
    throw new StageError("PAY_GATE", "The deposit hasn't cleared — mark it paid first (admins can force).");
  }

  const db = getDb();
  const [option, options] = await Promise.all([
    approved.selectedOptionId
      ? db.query.proposalOptions.findFirst({ where: eq(schema.proposalOptions.id, approved.selectedOptionId) })
      : null,
    db.select().from(schema.proposalOptions).where(eq(schema.proposalOptions.proposalId, approved.id)),
  ]);
  const chosen = option ?? options[0];

  // The SOW sources: the approved commercial shape + everything discovery captured.
  const sources: string[] = [
    `APPROVED PROPOSAL (v${approved.version}): ${approved.title}`,
    approved.executiveSummaryMd ?? "",
    chosen ? `CHOSEN OPTION ${chosen.label}: ${chosen.name}\n${chosen.summaryMd}${chosen.timelineNote ? `\nTimeline: ${chosen.timelineNote}` : ""}` : "",
    approved.assumptionsMd ? `PROPOSAL ASSUMPTIONS\n${approved.assumptionsMd}` : "",
    deal.discoveryMd ? `DISCOVERY PACKAGE\n${deal.discoveryMd}` : "",
    deal.notes ? `DEAL NOTES\n${deal.notes}` : "",
    "INSTRUCTION: Build the statement of work for the CHOSEN OPTION ONLY. Phases must reflect the chosen option's shape and timeline. Do not include work that only belongs to the option that was not chosen.",
  ].filter(Boolean);

  const { draft, usage } = await draftProject(ctx, {
    organizationId: deal.organizationId,
    files: [],
    pastedText: sources.join("\n\n---\n\n"),
  });

  const { projectId } = await createDraftedProject(ctx, {
    organizationId: deal.organizationId,
    name: draft.name,
    description: draft.description,
    workType: draft.workType,
    aiContextMd: draft.projectContextMd,
    stages: draft.stages,
    clientMessage: draft.clientMessage,
    postToThread: true,
  });

  await db.batch([
    db.update(schema.deals).set({ projectId }).where(eq(schema.deals.id, dealId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "contract.executed",
        entityType: "deal",
        entityId: dealId,
        metadata: { projectId, proposalId: approved.id, model: usage.model, costCents: usage.costCents },
      }),
    ),
  ]);

  // Signed contract == the prospect became a customer. Won handles org activation
  // + discovery→memory graduation and is idempotent-safe on stage.
  if (deal.stage !== "won") await setDealStage(ctx, dealId, "won");

  return { projectId, usage };
}
