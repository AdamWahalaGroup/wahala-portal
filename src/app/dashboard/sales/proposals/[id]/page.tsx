/**
 * Proposal editor page (frame 25) — slim breadcrumb chrome for width; the A/B
 * comparison is the centerpiece. Staff only.
 */
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SlimShell } from "@/components/SlimShell";
import { ProposalStatusPill } from "@/components/SalesChips";
import { ProposalEditor } from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const p = await getProposal(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";

  return (
    <SlimShell
      crumbs={[
        { label: "Sales", href: "/dashboard/sales" },
        { label: "Proposals", href: "/dashboard/sales/proposals" },
        { label: p.dealName, href: `/dashboard/sales/deals/${p.dealId}` },
        { label: `v${p.version}` },
      ]}
      user={{ name: ctx.user.name, role: ctx.user.role }}
      maxWidth={1120}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>{p.title}</h1>
        <ProposalStatusPill status={p.status} version={p.version} />
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        {p.organizationName} · {p.dealName}
      </div>

      <ProposalEditor proposal={p} canManage={canManage} />
    </SlimShell>
  );
}
