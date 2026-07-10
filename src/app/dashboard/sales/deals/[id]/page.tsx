/**
 * Deal drawer — the deal room rendered as a drawer over the persistent board
 * (prototype card layout: no tabs; proposal CTA on top, agreements inline at
 * Committed). The heavy sections are built here as server nodes. Staff only.
 * History left the drawer (audit backend + HistoryTimeline component intact —
 * relocation surface TBD).
 */
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getDealDetail } from "@/services/sales";
import { listProposalsForDeal } from "@/services/proposals";
import { getContractRoom } from "@/services/contract";
import { ensureNdaForDeal } from "@/services/agreements";
import { getDealProcess } from "@/services/process";
import { meetingsForDeal, syncIfStale } from "@/services/meetings";
import { zoomConfigured } from "@/services/integrations/zoom";
import { calendarConnection } from "@/services/integrations/google-calendar";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SalesDrawer } from "@/components/SalesDrawer";
import { DealDrawer } from "@/components/DealDrawer";
import { DealFieldsForm } from "@/components/DealEditor";
import { DiscoveryPanel } from "@/components/DiscoveryPanel";
import { ProposalsSection } from "@/components/ProposalsSection";
import { ContractRoom } from "@/components/ContractRoom";
import { NdaStrip } from "@/components/NdaStrip";

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
  const { deal, org, owner, contact, provenance } = detail;
  await syncIfStale(ctx); // keep meeting times/attendee responses fresh (Google's truth)
  const [proposals, room, process, meetings, connection, zoomReady, nda] = await Promise.all([
    listProposalsForDeal(ctx, deal.id),
    getContractRoom(ctx, deal.id),
    getDealProcess(ctx, deal.id),
    meetingsForDeal(ctx, deal.id),
    calendarConnection(ctx.user.id),
    zoomConfigured(),
    ensureNdaForDeal(ctx, deal.id),
  ]);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  // Lost = read-only: no creation paths, no edits — the drawer leads with the post-mortem.
  const lost = deal.stage === "lost";

  // v3: no proposal work on an unaccepted opportunity — accept into Discovery first.
  const proposalCtaNode = deal.stage === "new" ? (
    <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)", background: "var(--surface)", border: "1px dashed #D7D9DF", borderRadius: 10, padding: "10px 12px" }}>
      ◔ accept this opportunity into Discovery to start proposal work
    </div>
  ) : (
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
      readOnly={lost}
    />
  );
  const discoveryNode = <DiscoveryPanel dealId={deal.id} discoveryMd={deal.discoveryMd} canManage={canManage && !lost} />;
  // NDA at Discovery (10 Jul): protects the conversations about to happen. Committed
  // onward the full agreement package (ContractRoom) owns the row — no double render.
  const ndaNode =
    nda && org && ["discovery", "proposal_out", "negotiating"].includes(deal.stage) ? (
      <NdaStrip agreement={{ id: nda.id, status: nda.status, signedAt: nda.signedAt?.toISOString() ?? null }} orgId={org.id} canManage={canManage && !lost} />
    ) : null;
  const agreementsNode = room.available ? (
    <ContractRoom dealId={deal.id} orgId={org?.id ?? ""} room={room} canManage={canManage} isAdmin={ctx.isAdmin} orgName={org?.name ?? contact?.name ?? "the new account"} />
  ) : null;
  const fieldsNode = canManage && !lost ? (
    <DealFieldsForm dealId={deal.id} name={deal.name} valueCents={deal.valueCents} notes={deal.notes} />
  ) : (
    <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{deal.notes || "No notes yet."}</p>
  );

  return (
    <SalesDrawer routeEcho={`sales / deal / ${deal.name}`}>
      <DealDrawer
        deal={{ id: deal.id, name: deal.name, valueCents: deal.valueCents, stage: deal.stage, daysInStage: deal.daysInStage, stuck: deal.stuck, origin: deal.origin, subStatus: deal.subStatus, projectId: deal.projectId }}
        org={org ? { id: org.id, name: org.name, status: org.status } : null}
        owner={owner ? { name: owner.name } : null}
        contact={contact ? { id: contact.id, name: contact.name, email: contact.email, phone: contact.phone } : null}
        provenance={provenance ? { source: provenance.source, notes: provenance.notes, createdAt: provenance.createdAt.toISOString() } : null}
        scout={{ md: provenance?.scoutMd ?? null, score: provenance?.scoutScore ?? null, verdict: provenance?.scoutVerdict ?? null }}
        process={{
          trainingMode: process.trainingMode,
          readiness: process.readiness,
          fields: process.fields,
          journey: process.journey,
          journeyIndex: process.journeyIndex,
          goal: process.goal,
          nextActions: process.nextActions,
          calls: process.calls.map((c) => ({ ...c, recordedAt: c.recordedAt.toISOString() })),
          meetings: meetings.map((m) => ({
            id: m.id,
            title: m.title,
            startsAt: m.startsAt.toISOString(),
            endsAt: m.endsAt?.toISOString() ?? null,
            videoUrl: m.videoUrl,
            status: m.status,
            attendees: m.attendees,
            createdByName: m.createdByName,
            synced: m.synced,
            callId: m.callId,
            dealId: m.dealId,
          })),
          zoomReady,
          calendarConnected: connection.connected,
          memberEmail: connection.email ?? ctx.user.email,
        }}
        postMortemMd={deal.postMortemMd}
        proposalCtaNode={proposalCtaNode}
        discoveryNode={discoveryNode}
        agreementsNode={agreementsNode}
        ndaNode={ndaNode}
        fieldsNode={fieldsNode}
        canManage={canManage}
        isAdmin={ctx.isAdmin}
      />
    </SalesDrawer>
  );
}
