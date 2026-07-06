/**
 * Settings · Integrations (frame 47) — per-workspace page; each staff member
 * connects their OWN Google Calendar here; Zoom is the company-level row (admin
 * connects via Server-to-Server credentials). Staff-accessible (not admin-only)
 * so every member can manage their calendar connection.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { calendarConnection } from "@/services/integrations/google-calendar";
import { zoomConfigured } from "@/services/integrations/zoom";
import { upcomingSyncedCount } from "@/services/meetings";
import { trainingModeFor } from "@/services/process";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const [google, zoomReady, upcomingCount, trainingMode] = await Promise.all([
    calendarConnection(ctx.user.id),
    zoomConfigured(),
    upcomingSyncedCount(ctx),
    trainingModeFor(ctx),
  ]);

  return (
    <AppShell
      active="settings-integrations"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      trainingMode={trainingMode}
    >
      <div className="kicker">Settings</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Integrations</h1>
      <p style={{ margin: "6px 0 22px", color: "var(--muted)", fontSize: 14.5 }}>
        Calendar is per-member — connect your own. Zoom is company-wide. Connect is easy; disconnect is deliberate.
      </p>
      <IntegrationsPanel
        google={{
          connected: google.connected,
          email: google.email,
          connectedAt: google.connectedAt?.toISOString() ?? null,
          lastSyncAt: google.lastSyncAt?.toISOString() ?? null,
          pendingDisconnect: google.pendingDisconnect,
          upcomingCount,
        }}
        zoomConnected={zoomReady}
        isAdmin={ctx.isAdmin}
      />
    </AppShell>
  );
}
