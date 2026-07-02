/**
 * Sales home / Board (frame 21) — the Monday-meeting view. Staff only.
 * A true kanban (Triage = lead inbox, Won/Lost drop zones) with a ☰ List
 * fallback; the header + view toggle live inside SalesBoard so the
 * preference can persist client-side.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { salesOverview } from "@/services/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesBoard } from "@/components/SalesBoard";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const overview = await salesOverview(ctx);
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
      <SalesBoard overview={overview} canManage={canManage} />
    </AppShell>
  );
}
