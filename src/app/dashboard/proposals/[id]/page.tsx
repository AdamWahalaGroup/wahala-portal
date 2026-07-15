/**
 * Proposal — dedicated full page (HANDOFF-DELTA-2026-07-07): the phased
 * sign-off editor with the dark phase spine. Staff only. First-class nav item.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal, countSentProposals } from "@/services/proposals";
import { trainingModeFor } from "@/services/process";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { ProposalEditor } from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const [p, proposalCount, trainingMode] = await Promise.all([
    getProposal(ctx, id).catch((e) => {
      if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    countSentProposals(ctx),
    trainingModeFor(ctx),
  ]);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner" || (
    ctx.user.role === "sales_rep" && p.dealOwnerUserId === ctx.user.id
  );

  return (
    <AppShell
      active="proposals"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      proposalCount={proposalCount}
      wide
    >
      <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)" }}>
        <Link href="/dashboard/proposals" style={{ color: "inherit" }}>Proposals</Link> /{" "}
        <Link href={`/dashboard/sales/deals/${p.dealId}`} style={{ color: "inherit" }}>{p.dealName}</Link> / v{p.version}
      </div>
      <div style={{ marginTop: 14 }}>
        <ProposalEditor proposal={p} canManage={canManage} trainingMode={trainingMode} />
      </div>
    </AppShell>
  );
}
