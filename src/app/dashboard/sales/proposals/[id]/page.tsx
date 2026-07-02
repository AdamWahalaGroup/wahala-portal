/**
 * Proposal editor page (frame 25) — full app sidebar (the left nav never disappears)
 * with a wide content column; the A/B comparison is the centerpiece. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
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
    <AppShell
      active="sales-proposals"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      wide
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <BackButton fallbackHref="/dashboard/sales/proposals" />
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          <Link href="/dashboard/sales">Sales</Link> / <Link href="/dashboard/sales/proposals">Proposals</Link> /{" "}
          <Link href={`/dashboard/sales/deals/${p.dealId}`}>{p.dealName}</Link> /{" "}
          <span style={{ color: "var(--ink)" }}>v{p.version}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>{p.title}</h1>
        <ProposalStatusPill status={p.status} version={p.version} />
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        {p.organizationName} · {p.dealName}
      </div>

      <ProposalEditor proposal={p} canManage={canManage} />
    </AppShell>
  );
}
