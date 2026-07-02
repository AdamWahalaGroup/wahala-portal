/**
 * Admin settings · SLAs & nudges (frame 28) — the thresholds that decide when the
 * Board turns something amber. They nudge, never block. Wahala admin only.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getSlaSettings } from "@/services/sla-settings";
import { DEFAULT_SLA_SETTINGS } from "@/domain/sla";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SlaSettingsForm } from "@/components/SlaSettingsForm";

export const dynamic = "force-dynamic";

export default async function SlaSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isAdmin) redirect("/dashboard");

  const settings = await getSlaSettings();

  return (
    <AppShell
      active="settings-slas"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="kicker">Settings · admin</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>SLAs &amp; nudges</h1>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
        Thresholds that decide when something turns amber. SLAs never block anything — they nudge.
      </p>
      <SlaSettingsForm settings={settings} defaults={DEFAULT_SLA_SETTINGS} />
    </AppShell>
  );
}
