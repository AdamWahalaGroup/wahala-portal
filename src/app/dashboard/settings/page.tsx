/**
 * Admin settings — per-AI-agent model + reasoning effort. Stored in app_settings,
 * read on every agent run, so changes are live immediately with no redeploy.
 * Wahala admin only.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { AGENT_DEFS, resolveAgentConfig, defaultAgentPrompt } from "@/services/ai/agent-config";
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
        systemPrompt: cfg.systemPrompt,
        defaultPrompt: defaultAgentPrompt(d.key),
        promptOverridden: cfg.promptOverridden,
      };
    }),
  );

  return (
    <AppShell
      active="settings-agents"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="kicker">Settings · admin</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>AI agents</h1>

      <section style={{ marginTop: 22 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
          Each agent&apos;s model, reasoning effort, and system prompt. Blank model = the deployment default.
          Saves apply on the agent&apos;s next run — no redeploy. Costs scale with the model you pick.
        </p>
        <AgentSettings agents={agents} />
      </section>

      {/* Cross-link to the sibling settings section (frame 28) */}
      <div style={{ marginTop: 20, border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="kicker" style={{ marginBottom: 3 }}>Looking for the thresholds?</div>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            The stuck-deal window, probability anchors, and nudge SLAs moved to their own page.
          </span>
        </div>
        <Link href="/dashboard/settings/slas" style={{ fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
          SLAs &amp; nudges →
        </Link>
      </div>
    </AppShell>
  );
}
