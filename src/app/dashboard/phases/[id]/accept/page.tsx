/**
 * Acceptance (design frame 07) — the client's formal, logged accept / request-revision
 * moment for a DELIVERED stage, designed mobile-first. Staff and non-delivered stages
 * redirect to the read-only stage screen. The buttons shown follow the server's
 * available actions for this client role.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getStageDetail } from "@/services/stages";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { AcceptanceChecklist } from "@/components/AcceptanceChecklist";

export const dynamic = "force-dynamic";

export default async function AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const detail = await getStageDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { stage, lineItems, actions } = detail;

  // Client-only acceptance screen, and only while the stage is delivered.
  if (ctx.isStaff || stage.status !== "delivered") redirect(`/dashboard/phases/${id}`);

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={detail.organizationName}
      accountOwner={detail.people.accountOwner ? { name: detail.people.accountOwner } : null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", maxWidth: 390, margin: "0 auto 8px" }}>
        <Link href={`/dashboard/phases/${stage.id}`}>← Back to stage</Link>
      </div>
      {stage.billingMode === "on_delivery" && !stage.paidAt && (
        <div style={{ maxWidth: 420, margin: "0 auto 14px", background: "#FFFAF2", border: "1px solid #FADCB4", color: "#92400e", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.45 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Awaiting payment confirmation</div>
          This phase is billed on delivery. Once your Wahala representative confirms your payment has landed, the Accept button will unlock here.
        </div>
      )}
      <AcceptanceChecklist
        stageId={stage.id}
        stageName={stage.name}
        items={lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          estimateNote: li.estimateNote,
          amountCents: li.amountCents,
          groupLabel: li.groupLabel,
        }))}
        totalCents={stage.totalAmountCents}
        canAccept={actions.includes("accept")}
        canRequestRevision={actions.includes("request_revision")}
      />
    </AppShell>
  );
}
