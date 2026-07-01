/**
 * Proposal editor page (staff) — one version of one deal's commercial offering.
 * Draft: edit + price + send. Sent: share link + record response. AI complexity
 * above 3 shows the engineering-review banner (soft flag).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getProposal } from "@/services/proposals";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { ProposalEditor } from "@/components/ProposalEditor";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "var(--surface)", color: "var(--ink-soft)", label: "Draft" },
  sent: { bg: "#F5F7FF", color: "#3B5BDB", label: "Sent" },
  approved: { bg: "#e8f7ee", color: "#15803d", label: "Approved" },
  declined: { bg: "#fdeeee", color: "#b91c1c", label: "Declined" },
  superseded: { bg: "var(--surface-soft)", color: "var(--muted)", label: "Superseded" },
};

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
  const chip = STATUS_CHIP[p.status];

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard/sales">Sales</Link> /{" "}
        <Link href={`/dashboard/sales/deals/${p.dealId}`}>{p.dealName}</Link> / Proposal v{p.version}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>{p.title}</h1>
        <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: chip.bg, color: chip.color }}>
          {chip.label} · v{p.version}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        {p.organizationName}
      </div>

      <ProposalEditor proposal={p} canManage={canManage} />
    </AppShell>
  );
}
