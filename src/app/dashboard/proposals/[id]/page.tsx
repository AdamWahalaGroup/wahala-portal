/**
 * Proposal — the dedicated full page (Jason feedback: proposals deserve a real
 * page, not the quick-view drawer). Wide shell so Option A / Option B sit side
 * by side; the old drawer route redirects here. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
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
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      wide
    >
      {/* Breadcrumb */}
      <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)" }}>
        <Link href="/dashboard/sales" style={{ color: "inherit" }}>Sales board</Link> /{" "}
        <Link href="/dashboard/proposals" style={{ color: "inherit" }}>Proposals</Link> /{" "}
        <Link href={`/dashboard/sales/deals/${p.dealId}`} style={{ color: "inherit" }}>{p.dealName}</Link> / v{p.version}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em", flex: 1, minWidth: 0 }}>{p.title}</h1>
        <ProposalStatusPill status={p.status} version={p.version} />
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>
        {p.organizationName} · <Link href={`/dashboard/sales/deals/${p.dealId}`}>{p.dealName}</Link>
      </div>

      <div style={{ marginTop: 20 }}>
        <ProposalEditor proposal={p} canManage={canManage} />
      </div>
    </AppShell>
  );
}
