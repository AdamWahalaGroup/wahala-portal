/**
 * AI draft provider abstraction (the swap seam).
 *
 * "Draft a project with AI" (design frames 18–20) goes through this interface, so the
 * concrete model/API lives in ONE file (e.g. openai.ts). Adding Claude later = add
 * src/services/ai/anthropic.ts and one factory branch — nothing else in the app changes.
 */
import { aiProvider } from "@/auth/server-env";

/** Multi-modal input parts. PDFs and images are forwarded to the model as-is. */
export type DraftPart =
  | { kind: "text"; text: string }
  | { kind: "image"; mime: string; b64: string }
  | { kind: "pdf"; name: string; b64: string };

/** The structured output the model must return. No prices, no client match (by design). */
export type ProjectDraft = {
  name: string;
  description: string;
  workType: string;
  stages: {
    name: string;
    scopeDescription: string;
    deliverables: { epic: string; description: string }[];
  }[];
  clientMessage: string;
  /** Markdown memo: # title / ## Read / ## Inferred / ## Assumptions / ## Open questions. */
  projectContextMd: string;
};

export type DraftUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
};

export interface AiDraftProvider {
  draftProject(args: {
    system: string;
    parts: DraftPart[];
    model?: string;
    reasoningEffort?: string | null;
  }): Promise<{ draft: ProjectDraft; usage: DraftUsage }>;
  /**
   * Generic strict-JSON completion — same multi-modal parts, caller-supplied schema.
   * New AI features (discovery packages, estimators…) build on this instead of adding
   * per-feature provider methods. `model`/`reasoningEffort` come from the per-agent
   * admin settings; omitted = the env default model, no reasoning param sent.
   */
  completeStructured<T>(args: {
    system: string;
    parts: DraftPart[];
    schemaName: string;
    schema: object;
    model?: string;
    reasoningEffort?: string | null;
  }): Promise<{ output: T; usage: DraftUsage }>;
}

/**
 * JSON Schema for the ProjectDraft output. Authored in OpenAI strict-mode style
 * (additionalProperties:false everywhere, every property listed in required) so the
 * model is forced to produce a valid, parseable object in one pass.
 */
export const projectDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "workType", "stages", "clientMessage", "projectContextMd"],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    workType: { type: "string" },
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "scopeDescription", "deliverables"],
        properties: {
          name: { type: "string" },
          scopeDescription: { type: "string" },
          deliverables: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["epic", "description"],
              properties: {
                epic: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
    clientMessage: { type: "string" },
    projectContextMd: { type: "string" },
  },
} as const;

/** Per-1M-token prices (USD) for the cost-estimate readout. Update as pricing changes. */
const PRICING: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  "gpt-4o-mini": { inPerMTok: 0.15, outPerMTok: 0.6 },
  "gpt-4o": { inPerMTok: 2.5, outPerMTok: 10.0 },
};

export function estimateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING["gpt-4o-mini"];
  const dollars = (inputTokens / 1_000_000) * p.inPerMTok + (outputTokens / 1_000_000) * p.outPerMTok;
  return Math.max(0, Math.round(dollars * 100));
}

/** Pick the configured provider. Lazy-import so unused providers stay out of the bundle. */
export async function getDraftProvider(): Promise<AiDraftProvider> {
  const name = aiProvider();
  if (name === "openai") {
    const { OpenAiDraftProvider } = await import("./openai");
    return new OpenAiDraftProvider();
  }
  throw new Error(`Unknown AI_PROVIDER: ${name}`);
}
