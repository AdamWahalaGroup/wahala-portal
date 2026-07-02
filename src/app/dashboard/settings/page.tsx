/**
 * Admin settings — per-AI-agent model + reasoning effort. Stored in app_settings,
 * read on every agent run, so changes are live immediately with no redeploy.
 * Wahala admin only.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { AGENT_DEFS, resolveAgentConfig } from "@/services/ai/agent-config";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { AgentSettings } from "@/components/AgentSettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isAdmin) redirect("/dashboard");

  const agents = await Promise.all(
    AGENT_DEFS.map(async (d) => {
      const cfg = await resolveAgentConfig(d.key);
      return {
        key: d.key,
        label: d.label,
        description: d.description,
        supportsReasoning: d.supportsReasoning,
        defaultModel: d.defaultModel(),
        model: cfg.model,
        reasoningEffort: cfg.reasoningEffort,
        overridden: cfg.overridden,
      };
    }),
  );

  return (
    <AppShell
      active="settings"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="kicker">Admin</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Settings</h1>

      <section style={{ marginTop: 26 }}>
        <div className="kicker">AI agents</div>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
          Each agent&apos;s model and reasoning effort. Blank model = the deployment default. Saves apply on
          the agent&apos;s next run — no redeploy. Costs scale with the model you pick.
        </p>
        <AgentSettings agents={agents} />
      </section>
    </AppShell>
  );
}
