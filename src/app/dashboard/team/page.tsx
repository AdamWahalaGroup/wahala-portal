/**
 * Team — admin scorecard (frame 41), owners only. Promoted from a layer over the
 * sales board to its own nav destination (below Settings). All math from
 * process_events.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { teamScorecard, scorecardSignals } from "@/services/process";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { TeamScorecard } from "@/components/TeamScorecard";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isAdmin) redirect("/dashboard");

  const rows = await teamScorecard(ctx);
  const signals = scorecardSignals(rows);

  return (
    <AppShell
      active="team"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <TeamScorecard rows={rows} signals={signals} currentUserId={ctx.user.id} />
    </AppShell>
  );
}
