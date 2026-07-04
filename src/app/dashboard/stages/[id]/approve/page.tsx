/**
 * Quote approval (frame 36) — the client's dedicated review moment for a QUOTED
 * stage, mirroring the acceptance screen (frame 07). Staff and non-quoted stages
 * redirect to the read-only stage screen. Approval ≠ payment: the pay-gate comes
 * right after (Stripe when it lands; today the stage shows Approved / awaiting
 * payment).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getStageDetail } from "@/services/stages";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { QuoteApproval } from "@/components/QuoteApproval";

export const dynamic = "force-dynamic";

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const detail = await getStageDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { stage, lineItems, actions } = detail;

  // Client-only review screen, and only while the stage is quoted.
  if (ctx.isStaff || stage.status !== "quoted") redirect(`/dashboard/stages/${id}`);

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={detail.organizationName}
      accountOwner={detail.people.accountOwner ? { name: detail.people.accountOwner } : null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", maxWidth: 390, margin: "0 auto 8px" }}>
        <Link href={`/dashboard/stages/${stage.id}`}>← Back to stage</Link>
      </div>
      <QuoteApproval
        stageId={stage.id}
        projectId={stage.projectId}
        stageName={stage.name}
        scope={stage.scopeDescription}
        items={lineItems.map((li) => ({ id: li.id, description: li.description, groupLabel: li.groupLabel }))}
        totalCents={stage.totalAmountCents}
        canApprove={actions.includes("approve_quote")}
      />
    </AppShell>
  );
}
