/**
 * Per-agent AI configuration — the registry of every AI agent in the portal and
 * the admin-tunable model + reasoning effort for each, stored in app_settings
 * (`agent:<key>` rows) with env-var defaults. Changing a model is a settings
 * save, not a redeploy.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiDraftModel, aiSearchModel } from "@/auth/server-env";

export const REASONING_EFFORTS = ["minimal", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type AgentDef = {
  key: string;
  label: string;
  description: string;
  /** Where the env default comes from when no setting row exists. */
  defaultModel: () => string;
  /** Search agents need a web-search-capable model; reasoning effort doesn't apply. */
  supportsReasoning: boolean;
};

export const AGENT_DEFS: AgentDef[] = [
  {
    key: "project_draft",
    label: "Project draft / SOW writer",
    description: "Drafts whole projects from dumped files, and writes the SOW when a contract executes.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "discovery",
    label: "Discovery analyst",
    description: "Distills call transcripts into the Discovery Package on a deal (merges across calls).",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "proposal",
    label: "Proposal writer",
    description: "Drafts Option A/B proposals from discovery, with the 1–5 complexity score. Never prices.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "taskgen",
    label: "Task breakdown",
    description: "Breaks a phase's SOW deliverables into internal engineering tasks for the delivery team.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "lead_scout",
    label: "Lead scout (analysis)",
    description: "The sales-lead expert: reads the lead's dump + recon, scores 1–10, pursue/probe/pass.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "lead_recon",
    label: "Lead recon (web search)",
    description: "The web-research pass before the scout. Must be a search-capable model.",
    defaultModel: aiSearchModel,
    supportsReasoning: false,
  },
];

export type AgentConfig = {
  model: string;
  reasoningEffort: ReasoningEffort | null;
  /** True when the model came from a settings row rather than the env default. */
  overridden: boolean;
};

type StoredAgentSetting = { model?: string; reasoningEffort?: string };

function defFor(agentKey: string): AgentDef {
  const def = AGENT_DEFS.find((d) => d.key === agentKey);
  if (!def) throw new Error(`Unknown AI agent: ${agentKey}`);
  return def;
}

/** Effective config for one agent: settings row → env default. Call inside a request. */
export async function resolveAgentConfig(agentKey: string): Promise<AgentConfig> {
  const def = defFor(agentKey);
  const row = await getDb().query.appSettings.findFirst({ where: eq(schema.appSettings.key, `agent:${agentKey}`) });
  const stored = (row?.value ?? {}) as StoredAgentSetting;
  const model = stored.model?.trim() || def.defaultModel();
  const effort =
    def.supportsReasoning && stored.reasoningEffort && (REASONING_EFFORTS as readonly string[]).includes(stored.reasoningEffort)
      ? (stored.reasoningEffort as ReasoningEffort)
      : null;
  return { model, reasoningEffort: effort, overridden: !!stored.model?.trim() || !!effort };
}

/** Persist an agent's override. Empty model = back to the env default; effort "" = off. */
export async function saveAgentConfig(
  agentKey: string,
  input: { model: string; reasoningEffort: string },
  updatedByUserId: string,
): Promise<void> {
  const def = defFor(agentKey);
  const model = input.model.trim();
  const effort = def.supportsReasoning && (REASONING_EFFORTS as readonly string[]).includes(input.reasoningEffort)
    ? input.reasoningEffort
    : "";
  const db = getDb();
  const key = `agent:${agentKey}`;
  if (!model && !effort) {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key));
    return;
  }
  const value: StoredAgentSetting = {};
  if (model) value.model = model;
  if (effort) value.reasoningEffort = effort;
  const existing = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, key) });
  if (existing) {
    await db.update(schema.appSettings).set({ value, updatedByUserId }).where(eq(schema.appSettings.key, key));
  } else {
    await db.insert(schema.appSettings).values({ key, value, updatedByUserId });
  }
}
