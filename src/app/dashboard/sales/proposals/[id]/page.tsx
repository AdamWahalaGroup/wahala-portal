/**
 * Proposal editor (frame 29) — the A/B editor as a drawer over the board. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SalesDrawer } from "@/components/SalesDrawer";
import { ProposalStatusPill } from "@/components/SalesChips";
import { ProposalEditor } from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

export default async function ProposalDrawerPage({ params }: { params: Promise<{ id: string }> }) {
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
    <SalesDrawer routeEcho={`sales / proposal / ${p.dealName} · v${p.version}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{p.title}</h1>
        <ProposalStatusPill status={p.status} version={p.version} />
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        {p.organizationName} · <Link href={`/dashboard/sales/deals/${p.dealId}`}>{p.dealName}</Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <ProposalEditor proposal={p} canManage={canManage} />
      </div>
    </SalesDrawer>
  );
}
