/**
 * Per-agent AI configuration — the registry of every AI agent in the portal and
 * the admin-tunable model + reasoning effort for each, stored in app_settings
 * (`agent:<key>` rows) with env-var defaults. Changing a model is a settings
 * save, not a redeploy.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { aiDraftModel, aiSearchModel } from "@/auth/server-env";
import { DEFAULT_AGENT_PROMPTS } from "./prompts";

export const PROMPT_MAX_CHARS = 20000;

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
    label: "Contact scout (analysis)",
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
  {
    key: "package_extractor",
    label: "Discovery evidence analyst",
    description: "Analyzes each call once, then proposes memo, readiness, qualification, and commercial updates for human review.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
  {
    key: "deal_pulse",
    label: "Deal pulse (fit + suggestions)",
    description:
      "The per-deal conductor: runs on the daily cron, scores business FIT 0–10 (form/fit/function/Wahala value) and drops ≤3 concrete suggestions in the deal's suggestion box. Budget-capped per deal.",
    defaultModel: aiDraftModel,
    supportsReasoning: true,
  },
];

export type AgentConfig = {
  model: string;
  reasoningEffort: ReasoningEffort | null;
  /** Effective system prompt: admin override when saved, else the code default. */
  systemPrompt: string;
  /** True when the model came from a settings row rather than the env default. */
  overridden: boolean;
  /** True when the system prompt came from a settings row rather than code. */
  promptOverridden: boolean;
};

type StoredAgentSetting = { model?: string; reasoningEffort?: string; systemPrompt?: string };

export function defaultAgentPrompt(agentKey: string): string {
  const p = DEFAULT_AGENT_PROMPTS[agentKey];
  if (!p) throw new Error(`No default prompt for AI agent: ${agentKey}`);
  return p;
}

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
  const promptOverride = stored.systemPrompt?.trim() || "";
  return {
    model,
    reasoningEffort: effort,
    systemPrompt: promptOverride || defaultAgentPrompt(agentKey),
    overridden: !!stored.model?.trim() || !!effort,
    promptOverridden: !!promptOverride,
  };
}

/**
 * Persist an agent's override. Empty model = back to the env default; effort "" = off;
 * systemPrompt empty or byte-identical to the code default = no prompt override.
 */
export async function saveAgentConfig(
  agentKey: string,
  input: { model: string; reasoningEffort: string; systemPrompt?: string },
  updatedByUserId: string,
): Promise<void> {
  const def = defFor(agentKey);
  const model = input.model.trim();
  const effort = def.supportsReasoning && (REASONING_EFFORTS as readonly string[]).includes(input.reasoningEffort)
    ? input.reasoningEffort
    : "";
  const db = getDb();
  const key = `agent:${agentKey}`;
  const existingRow = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, key) });
  // systemPrompt omitted = preserve whatever override exists; "" or the default text = clear it.
  let prompt: string;
  if (input.systemPrompt === undefined) {
    prompt = ((existingRow?.value ?? {}) as StoredAgentSetting).systemPrompt?.trim() ?? "";
  } else {
    prompt = input.systemPrompt.trim();
    if (prompt === defaultAgentPrompt(agentKey).trim()) prompt = "";
    if (prompt.length > PROMPT_MAX_CHARS) {
      throw new Error(`System prompt too long (${prompt.length} chars; max ${PROMPT_MAX_CHARS}).`);
    }
  }
  if (!model && !effort && !prompt) {
    await db.delete(schema.appSettings).where(eq(schema.appSettings.key, key));
    return;
  }
  const value: StoredAgentSetting = {};
  if (model) value.model = model;
  if (effort) value.reasoningEffort = effort;
  if (prompt) value.systemPrompt = prompt;
  if (existingRow) {
    await db.update(schema.appSettings).set({ value, updatedByUserId }).where(eq(schema.appSettings.key, key));
  } else {
    await db.insert(schema.appSettings).values({ key, value, updatedByUserId });
  }
}
