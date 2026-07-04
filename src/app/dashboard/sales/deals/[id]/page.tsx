/**
 * Deal drawer (frames 29 + 34) — the deal room rendered as a drawer over the
 * persistent board layout. The heavy sections (discovery, proposals, agreements,
 * history, fields) are built here as server nodes and handed to the client
 * DealDrawer, which arranges them into Overview · Proposal · Agreements · History.
 * Staff only.
 */
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getDealDetail } from "@/services/sales";
import { listProposalsForDeal } from "@/services/proposals";
import { getContractRoom } from "@/services/contract";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SalesDrawer } from "@/components/SalesDrawer";
import { DealDrawer } from "@/components/DealDrawer";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { DealFieldsForm } from "@/components/DealEditor";
import { DiscoveryPanel } from "@/components/DiscoveryPanel";
import { ProposalsSection } from "@/components/ProposalsSection";
import { ContractRoom } from "@/components/ContractRoom";

export const dynamic = "force-dynamic";

export default async function DealDrawerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const detail = await getDealDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { deal, org, owner, contact, provenance, history } = detail;
  const [proposals, room] = await Promise.all([
    listProposalsForDeal(ctx, deal.id),
    getContractRoom(ctx, deal.id),
  ]);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";

  const proposalNode = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <DiscoveryPanel dealId={deal.id} discoveryMd={deal.discoveryMd} canManage={canManage} />
      <ProposalsSection
        dealId={deal.id}
        proposals={proposals.map((p) => ({
          id: p.id,
          version: p.version,
          status: p.status,
          title: p.title,
          complexityScore: p.complexityScore,
          needsReview: p.needsReview,
          selectedLabel: p.selectedLabel,
        }))}
        canManage={canManage}
        hasDiscovery={!!deal.discoveryMd}
      />
    </div>
  );
  const agreementsNode = room.available ? (
    <ContractRoom dealId={deal.id} orgId={org.id} room={room} canManage={canManage} isAdmin={ctx.isAdmin} orgName={org.name} />
  ) : null;
  const fieldsNode = canManage ? (
    <DealFieldsForm dealId={deal.id} name={deal.name} valueCents={deal.valueCents} notes={deal.notes} />
  ) : (
    <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{deal.notes || "No notes yet."}</p>
  );

  return (
    <SalesDrawer routeEcho={`sales / deal / ${deal.name}`}>
      <DealDrawer
        deal={{ id: deal.id, name: deal.name, valueCents: deal.valueCents, stage: deal.stage, daysInStage: deal.daysInStage, stuck: deal.stuck, origin: deal.origin, subStatus: deal.subStatus }}
        org={{ id: org.id, name: org.name, status: org.status }}
        owner={owner ? { name: owner.name } : null}
        contact={contact ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone } : null}
        provenance={provenance ? { source: provenance.source, notes: provenance.notes, createdAt: provenance.createdAt.toISOString() } : null}
        scout={{ md: provenance?.scoutMd ?? null, score: provenance?.scoutScore ?? null, verdict: provenance?.scoutVerdict ?? null }}
        proposalNode={proposalNode}
        agreementsNode={agreementsNode}
        historyNode={<HistoryTimeline items={history} />}
        fieldsNode={fieldsNode}
        canManage={canManage}
      />
    </SalesDrawer>
  );
}
