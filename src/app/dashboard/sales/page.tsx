/**
 * Sales home / pipeline board (frame 21) — the Monday-meeting view. Staff only.
 * Sub-nav + segmented tabs make Board/Leads/Proposals reachable two ways.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { salesOverview } from "@/services/sales";
import { listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesBoard } from "@/components/SalesBoard";
import { SalesTabs } from "@/components/SalesTabs";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const [overview, orgs, staff] = await Promise.all([
    salesOverview(ctx),
    scopedDb(ctx).listOrganizations(),
    listWahalaStaff(ctx),
  ]);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const newLeadCount = overview.leads.filter((l) => l.status === "new").length;

  return (
    <AppShell
      active="sales-board"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      leadCount={newLeadCount}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="kicker">Sales</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Pipeline</h1>
        </div>
        <SalesTabs active="board" />
        <Link
          href="/dashboard/sales/leads"
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            borderRadius: 9,
            padding: "9px 15px",
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: "none",
            flex: "none",
          }}
        >
          + Capture lead
        </Link>
      </div>
      <SalesBoard overview={overview} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} staff={staff} canManage={canManage} />
    </AppShell>
  );
}
