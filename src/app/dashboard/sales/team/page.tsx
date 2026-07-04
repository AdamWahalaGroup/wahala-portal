/**
 * Admin scorecard (frame 41) — /dashboard/sales/team, owners only. A child of the
 * sales layout, so it renders as a full layer over the persistent board (← Board /
 * Esc return without a board remount). All math from process_events.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { teamScorecard, scorecardSignals } from "@/services/process";
import { LOGIN_PATH } from "@/auth/config";
import { TeamScorecard } from "@/components/TeamScorecard";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isAdmin) redirect("/dashboard/sales");

  const rows = await teamScorecard(ctx);
  const signals = scorecardSignals(rows);

  return <TeamScorecard rows={rows} signals={signals} currentUserId={ctx.user.id} />;
}
