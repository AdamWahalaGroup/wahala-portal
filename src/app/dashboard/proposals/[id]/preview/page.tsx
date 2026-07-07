/**
 * Public-page preview (staff-only) — what the client will see, before a share
 * link exists (drafts have no token; the real link is minted on send). Renders
 * the exact public chrome with sign/decline disabled.
 */
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { Brand } from "@/components/Brand";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { PublicProposal } from "@/components/PublicProposal";

export const dynamic = "force-dynamic";

export default async function ProposalPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const p = await getProposal(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-soft)" }}>
      <div className="mono" style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", background: "#FFF7ED", color: "#B45309", padding: "6px 12px" }}>
        PREVIEW — this is what the client sees · the real link is created on send
      </div>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 18px 70px" }}>
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
          token="preview"
          preview
          status={p.status === "draft" || p.status === "superseded" ? "sent" : p.status}
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
      </div>
    </div>
  );
}
