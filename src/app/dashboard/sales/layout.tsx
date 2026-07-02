/**
 * Sales layout (frame 29, one-surface model). The BOARD lives here so it persists
 * across child navigation — soft-navigating to /sales/deals/[id] swaps only the child
 * segment (the drawer), and the board never remounts, so scroll + client filter state
 * survive. Deep links / refresh render the same URL server-side: board backdrop +
 * drawer open, no dead-end. Filters live in the URL (searchParams), read client-side
 * by the board. No intercepting/parallel routes — only well-supported primitives.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { salesOverview } from "@/services/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesBoard } from "@/components/SalesBoard";

export const dynamic = "force-dynamic";

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const overview = await salesOverview(ctx);
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const newLeadCount = overview.leads.filter((l) => l.status === "new").length;

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      leadCount={newLeadCount}
    >
      <SalesBoard overview={overview} canManage={canManage} currentUserId={ctx.user.id} />
      {/* Child segments render the drawer overlay (deal/lead/proposal); null on the bare board. */}
      {children}
    </AppShell>
  );
}
