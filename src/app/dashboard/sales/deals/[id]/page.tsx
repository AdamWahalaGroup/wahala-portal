/**
 * Deal detail — one opportunity's home: fields, stage disposition, provenance
 * (source lead), contact, and the audited stage history. This is where R2's
 * discovery capture (notes, recordings, transcripts → Discovery Package) will
 * attach. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getDealDetail } from "@/services/sales";
import { STAGE_META } from "@/domain/sales";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { Money } from "@/components/Money";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { PeopleCard } from "@/components/People";
import { DealStageSelect, DealFieldsForm } from "@/components/DealEditor";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const detail = await getDealDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { deal, org, owner, contact, sourceLead, history } = detail;
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const meta = STAGE_META[deal.stage];

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard/sales">Sales</Link> / {deal.name}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", marginTop: 18 }}>
        {/* Main */}
        <div style={{ paddingRight: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{deal.name}</h1>
            <span
              className="kicker"
              style={{
                fontSize: 10,
                padding: "4px 10px",
                borderRadius: 999,
                background: deal.stage === "won" ? "#e8f7ee" : deal.stage === "lost" ? "#fdeeee" : "var(--surface)",
                color: deal.stage === "won" ? "#15803d" : deal.stage === "lost" ? "#b91c1c" : "var(--ink-soft)",
              }}
            >
              {meta.label}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            <Link href={`/dashboard/clients/${org.id}`}>{org.name}</Link>
            {" · "}
            {org.status === "prospect" ? "prospect" : org.status}
            {" · "}
            {deal.daysInStage}d in stage{deal.stuck ? " ⚠ stuck" : ""}
          </div>

          <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
            {canManage ? (
              <DealFieldsForm dealId={deal.id} name={deal.name} valueCents={deal.valueCents} notes={deal.notes} />
            ) : (
              <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>
                {deal.notes || "No notes yet."}
              </p>
            )}
          </section>

          {sourceLead && (
            <section style={{ marginTop: 20 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Where this came from</div>
              <div style={{ background: "#fffdf5", border: "1px solid #f0e6c8", borderRadius: 11, padding: "12px 15px", fontSize: 13.5, color: "var(--ink-soft)" }}>
                Lead captured {new Date(sourceLead.createdAt).toLocaleDateString()}
                {sourceLead.source ? <> · via <strong>{sourceLead.source}</strong></> : null}
                {sourceLead.notes && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{sourceLead.notes}</p>}
              </div>
            </section>
          )}
        </div>

        {/* Right rail */}
        <aside style={{ borderLeft: "1px solid var(--border)", paddingLeft: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div className="kicker">Estimated value</div>
            <Money cents={deal.valueCents} style={{ display: "block", fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", marginTop: 4 }} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Gut number — pricing happens at Proposal.</div>
          </div>

          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)" }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Stage</div>
            {canManage ? (
              <DealStageSelect dealId={deal.id} stage={deal.stage} />
            ) : (
              <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <div className="kicker" style={{ marginBottom: 12 }}>History</div>
            <HistoryTimeline items={history} />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
