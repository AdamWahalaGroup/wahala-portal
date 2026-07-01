/**
 * Sales — the CRM front half (R1): lead inbox + stage-grouped pipeline funnel.
 * Staff only; clients are redirected to their dashboard. Stages here are sales
 * dispositions (skippable, unenforced); delivery Phases and their gates live on
 * projects. See docs/brain_storming/synthesis.md.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { salesOverview } from "@/services/sales";
import { listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesBoard } from "@/components/SalesBoard";

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

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="kicker">Wahala staff</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Sales</h1>
      <SalesBoard overview={overview} orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} staff={staff} canManage={canManage} />
    </AppShell>
  );
}
