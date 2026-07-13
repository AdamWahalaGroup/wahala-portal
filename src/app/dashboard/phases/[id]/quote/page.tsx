/**
 * Quote / scope builder (design frame 06) — staff author a draft stage's itemized
 * quote, then send it. Draft-only; admin or the org's Account Owner. A sent quote
 * (or no edit permission) redirects to the read-only stage screen.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getStageDetail } from "@/services/stages";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { adminApprovalThresholdCents } from "@/auth/server-env";

export const dynamic = "force-dynamic";

export default async function QuoteBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const detail = await getStageDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { stage, resource } = detail;

  // Only a draft quote is editable; a sent quote → the read-only stage screen.
  if (stage.status !== "draft") redirect(`/dashboard/phases/${id}`);

  // Quote authoring is admin or the org's Account Owner only.
  const isOwner = ctx.user.id === resource.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) redirect(`/dashboard/phases/${id}`);

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={detail.organizationName}
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard">Projects</Link> /{" "}
        <Link href={`/dashboard/projects/${stage.projectId}`}>Project</Link> /{" "}
        <Link href={`/dashboard/phases/${stage.id}`}>{stage.name}</Link> / Build quote
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 6px" }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Build quote</h1>
        <StatusBadge status={stage.status} />
      </div>
      <p style={{ margin: "0 0 24px", color: "var(--muted)", fontSize: 14 }}>
        Itemize the scope and price. This becomes the client&apos;s acceptance checklist when you send it.
      </p>

      <QuoteBuilder
        stageId={stage.id}
        projectId={stage.projectId}
        initialName={stage.name}
        initialScope={stage.scopeDescription ?? ""}
        initialItems={detail.lineItems.map((li) => ({
          description: li.description,
          estimateNote: li.estimateNote,
          amountCents: li.amountCents,
          groupLabel: li.groupLabel,
        }))}
        initialTotalCents={stage.totalAmountCents}
        initialBillingMode={stage.billingMode as "upfront" | "on_delivery"}
        thresholdCents={adminApprovalThresholdCents()}
        isAdmin={ctx.isAdmin}
      />
    </AppShell>
  );
}
