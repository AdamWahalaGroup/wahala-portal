/**
 * Deal room (frame 24) — one opportunity's home. A sales-stage spine runs across
 * the top (visited ✓ / current ring / skipped dashed), and the section matching
 * the deal's CURRENT stage sorts to the top with the emphasized "NEXT" treatment:
 * Discovery-ish → discovery leads; Proposal/Negotiation → proposals lead;
 * Contract/Won → the contract room leads. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getDealDetail } from "@/services/sales";
import { listProposalsForDeal } from "@/services/proposals";
import { getContractRoom } from "@/services/contract";
import { STAGE_META } from "@/domain/sales";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Money } from "@/components/Money";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { PeopleCard } from "@/components/People";
import { SalesStepper } from "@/components/SalesStepper";
import { STAGE_COLORS } from "@/components/SalesChips";
import { DealStageSelect, DealFieldsForm } from "@/components/DealEditor";
import { DiscoveryPanel } from "@/components/DiscoveryPanel";
import { ProposalsSection } from "@/components/ProposalsSection";
import { ContractRoom } from "@/components/ContractRoom";

export const dynamic = "force-dynamic";

/** Emphasis frame for the leading section: ink outline + dark "NEXT" header bar. */
function NextFrame({ hint, children }: { hint: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "2px solid var(--ink)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ background: "var(--ink)", color: "var(--white)", padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <span className="kicker" style={{ fontSize: 9, background: "rgba(255,255,255,.18)", padding: "2px 8px", borderRadius: 5, color: "var(--white)" }}>
          NEXT
        </span>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{hint}</span>
      </div>
      <div style={{ padding: 16, background: "var(--white)" }}>{children}</div>
    </div>
  );
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const detail = await getDealDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { deal, org, owner, contact, sourceLead, history, visitedStages } = detail;
  const [proposals, contractRoom] = await Promise.all([
    listProposalsForDeal(ctx, deal.id),
    getContractRoom(ctx, deal.id),
  ]);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const meta = STAGE_META[deal.stage];

  // Section ordering: the current stage's work leads and gets the NEXT treatment.
  const discoveryNode = <DiscoveryPanel dealId={deal.id} discoveryMd={deal.discoveryMd} canManage={canManage} />;
  const proposalsNode = (
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
  );
  const contractNode = contractRoom.available ? (
    <ContractRoom dealId={deal.id} room={contractRoom} canManage={canManage} />
  ) : null;

  type Sec = { key: string; node: React.ReactNode; hint: string };
  const discovery: Sec = { key: "discovery", node: discoveryNode, hint: "Capture what you're learning — paste the call transcript" };
  const proposalsSec: Sec = { key: "proposals", node: proposalsNode, hint: proposals.some((p) => p.status === "sent") ? "Proposal is out — chase the response" : "Get the proposal in front of them" };
  const contract: Sec | null = contractNode
    ? { key: "contract", node: contractNode, hint: deal.stage === "won" ? "Contract executed — delivery has it" : "Close it — commercials, invite, execute" }
    : null;

  let ordered: Sec[];
  if (deal.stage === "contract" || deal.stage === "won") {
    ordered = [contract, proposalsSec, discovery].filter(Boolean) as Sec[];
  } else if (deal.stage === "proposal" || deal.stage === "negotiation") {
    ordered = [proposalsSec, contract, discovery].filter(Boolean) as Sec[];
  } else {
    ordered = [discovery, proposalsSec, contract].filter(Boolean) as Sec[];
  }

  return (
    <AppShell
      active="sales-board"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <BackButton fallbackHref="/dashboard/sales" />
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          <Link href="/dashboard/sales">Sales</Link> / <Link href="/dashboard/sales">Board</Link> /{" "}
          <span style={{ color: "var(--ink)" }}>{deal.name}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{deal.name}</h1>
        <span
          className="kicker"
          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: `${STAGE_COLORS[deal.stage]}1A`, color: STAGE_COLORS[deal.stage] }}
        >
          {meta.label}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        <Link href={`/dashboard/clients/${org.id}`}>{org.name}</Link>
        {" · "}
        {org.status === "prospect" ? "prospect" : org.status}
        {owner ? ` · owner ${owner.name}` : ""}
        {" · "}
        {deal.daysInStage}d in stage{deal.stuck ? " ⚠ stuck" : ""}
      </div>

      {/* The spine */}
      <div style={{ marginTop: 22, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 18px 12px" }}>
        <SalesStepper current={deal.stage} visited={visitedStages} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", marginTop: 22 }}>
        {/* Main — ordered by the current stage */}
        <div style={{ paddingRight: 30, display: "flex", flexDirection: "column", gap: 22 }}>
          {ordered.map((sec, i) =>
            i === 0 ? (
              <NextFrame key={sec.key} hint={sec.hint}>
                {sec.node}
              </NextFrame>
            ) : (
              <div key={sec.key}>{sec.node}</div>
            ),
          )}

          {/* Deal fields */}
          <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Deal record</div>
            {canManage ? (
              <DealFieldsForm dealId={deal.id} name={deal.name} valueCents={deal.valueCents} notes={deal.notes} />
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{deal.notes || "No notes yet."}</p>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside style={{ borderLeft: "1px solid var(--border)", paddingLeft: 26, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div className="kicker">Estimated value</div>
            <Money cents={deal.valueCents} style={{ display: "block", fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", marginTop: 4 }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Gut number — real pricing happens at Proposal.</div>
          </div>

          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, boxShadow: "var(--shadow-card)" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Stage</div>
            {canManage ? (
              <DealStageSelect dealId={deal.id} stage={deal.stage} />
            ) : (
              <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="kicker">People</div>
            {owner && <PeopleCard name={owner.name} role="Deal owner" variant="owner" />}
            {contact && (
              <div>
                <PeopleCard name={contact.name} role="Primary contact" variant="lead" />
                {(contact.email || contact.phone) && (
                  <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                    {[contact.email, contact.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>History</div>
            <HistoryTimeline items={history} />
          </div>

          {sourceLead && (
            <div>
              <div className="kicker" style={{ marginBottom: 6 }}>Where this came from</div>
              <div style={{ background: "#fffdf5", border: "1px solid #f0e6c8", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                Lead captured {new Date(sourceLead.createdAt).toLocaleDateString()}
                {sourceLead.source ? <> · via <strong>{sourceLead.source}</strong></> : null}
                {sourceLead.notes && (
                  <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontStyle: "italic", color: "var(--muted)" }}>
                    &ldquo;{sourceLead.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
