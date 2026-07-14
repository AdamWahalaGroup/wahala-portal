/**
 * PUBLIC proposal page (HANDOFF-DELTA-2026-07-07 §3.3) — mobile-first sign
 * flow: ink header, exec summary, tap-to-select option tiles, type-your-name →
 * Sign & approve (or Decline), then the "Signed & sealed" takeover. No login;
 * the unguessable token is the credential. Draft/superseded 404.
 */
import { notFound } from "next/navigation";
import { getProposalByToken } from "@/services/proposals";
import { Brand } from "@/components/Brand";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { PublicProposal } from "@/components/PublicProposal";

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getProposalByToken(token);
  if (!p) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-soft)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 18px 70px" }}>
        {/* Ink header */}
        <div style={{ background: "var(--ink)", margin: "0 -18px", padding: "26px 22px 22px" }}>
          <Brand tone="light" size={20} />
          <div className="mono" style={{ fontSize: 10.5, color: "#8b909a", marginTop: 12, letterSpacing: ".1em" }}>
            PROPOSAL · V{p.version} · PREPARED FOR {p.organizationName.toUpperCase()}
          </div>
        </div>

        {p.executiveSummaryMd && (
          <section style={{ marginTop: 20, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
            <SimpleMarkdown md={p.executiveSummaryMd} size={14} />
          </section>
        )}

        <PublicProposal
          token={token}
          status={p.status}
          respondedByName={p.respondedByName}
          respondedAt={p.respondedAt ? p.respondedAt.toISOString() : null}
          selectedOptionId={p.selectedOptionId}
          options={p.options.map((o) => ({
            id: o.id,
            label: o.label,
            name: o.name,
            priceCents: o.priceCents,
            priceNote: o.priceNote,
            timelineNote: o.timelineNote,
            summaryMd: o.summaryMd,
            scopeDetails: o.scopeDetails,
            recommended: o.recommended,
            phases: o.phases,
          }))}
        />

        {p.assumptionsMd && (
          <section style={{ marginTop: 20, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Assumptions</div>
            <SimpleMarkdown md={p.assumptionsMd} size={13} />
          </section>
        )}

        <p style={{ margin: "26px 0 0", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
          Questions? Reply to your Wahala Group contact — we&apos;d rather answer than assume.
        </p>
      </div>
    </div>
  );
}
