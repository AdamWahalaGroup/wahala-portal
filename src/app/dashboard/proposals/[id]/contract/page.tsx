/**
 * Contract / SOW page (HANDOFF-DELTA-2026-07-07 §5) — the separate, linked
 * legal document generated from the proposal. Staff only; no contract yet →
 * back to the editor (the generate button lives there).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal, countSentProposals } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { ContractDoc } from "@/components/ContractDoc";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const [p, proposalCount] = await Promise.all([
    getProposal(ctx, id).catch((e) => {
      if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
      throw e;
    }),
    countSentProposals(ctx),
  ]);
  if (!p.contract) redirect(`/dashboard/proposals/${id}`);
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
        <Link href={`/dashboard/proposals/${p.id}`} style={{ color: "inherit" }}>{p.dealName}</Link> / contract
      </div>
      {/* The mono breadcrumb alone wasn't discoverable (founder QA, 10 Jul) — explicit way back. */}
      <Link
        href={`/dashboard/proposals/${p.id}`}
        style={{ display: "inline-block", margin: "10px 0 4px", fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}
      >
        ← Back to proposal
      </Link>
      <ContractDoc
        proposalId={p.id}
        organizationName={p.organizationName}
        contract={p.contract}
        contractStale={p.contractStale}
        canManage={canManage}
      />
    </AppShell>
  );
}
