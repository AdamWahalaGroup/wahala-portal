/**
 * Lead scout — the AI "sales lead expert" for a lead's unorganized dump.
 *
 * Two passes:
 *  1. Web recon (optional, graceful): a search-capable model looks the lead up —
 *     company, person, industry, recent news, red flags — and reports with source
 *     URLs. If the search model is unavailable, the scout proceeds without it and
 *     says so.
 *  2. Synthesis (structured): the regular provider reads everything — lead fields,
 *     notes, the dumped files (images/PDFs go in as-is), and the recon — and emits
 *     an opinion, associations the salesperson may have missed, and a rough 1–10
 *     effort-worthiness score with a pursue / probe / pass verdict.
 */
import { openaiApiKey } from "@/auth/server-env";
import { StageError } from "@/domain/stage-machine";
import { getDraftProvider, estimateCostCents, type DraftPart, type DraftUsage } from "./provider";
import { resolveAgentConfig } from "./agent-config";

export type LeadScoutResult = {
  analysisMd: string;
  score: number; // 1–10
  verdict: "pursue" | "probe" | "pass";
};

const scoutJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisMd", "score", "verdict"],
  properties: {
    analysisMd: { type: "string" },
    score: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    verdict: { type: "string", enum: ["pursue", "probe", "pass"] },
  },
} as const;



/** Web recon via the search-capable model. Returns null (never throws) when unavailable. */
export async function webRecon(query: string): Promise<{ text: string; usage: DraftUsage } | null> {
  const key = openaiApiKey();
  const cfg = await resolveAgentConfig("lead_recon");
  const model = cfg.model;
  if (!key || !model) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        web_search_options: {},
        messages: [
          { role: "system", content: cfg.systemPrompt },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`[lead-scout] web recon unavailable (${res.status}):`, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) return null;
    const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(data?.usage?.completion_tokens ?? 0);
    return {
      text: text.trim(),
      usage: { model, inputTokens, outputTokens, costCents: estimateCostCents(model, inputTokens, outputTokens) },
    };
  } catch (err) {
    console.error("[lead-scout] web recon failed:", err);
    return null;
  }
}

/** Synthesis pass: everything known about the lead → opinion + score + verdict. */
export async function scoutLead(input: {
  leadSummary: string; // CRM fields + notes, pre-formatted
  reconText: string | null;
  fileParts: DraftPart[]; // dumped files already converted to parts
  skippedFiles: string[]; // names of files too big / unreadable — the scout should know
}): Promise<{ result: LeadScoutResult; usage: DraftUsage }> {
  const parts: DraftPart[] = [{ kind: "text", text: `LEAD (CRM record + salesperson notes)\n\n${input.leadSummary}` }];
  if (input.reconText) {
    parts.push({ kind: "text", text: `WEB RECONNAISSANCE (with sources)\n\n${input.reconText}` });
  } else {
    parts.push({ kind: "text", text: "WEB RECONNAISSANCE\n\n(None available for this run.)" });
  }
  if (input.fileParts.length > 0) {
    parts.push({ kind: "text", text: "DUMPED MATERIAL (files/photos the salesperson attached follow)" });
    parts.push(...input.fileParts);
  }
  if (input.skippedFiles.length > 0) {
    parts.push({
      kind: "text",
      text: `NOTE: these attached files could not be read this run (too large or unsupported): ${input.skippedFiles.join(", ")}.`,
    });
  }

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("lead_scout");
  const { output, usage } = await provider.completeStructured<LeadScoutResult>({
    system: cfg.systemPrompt,
    parts,
    schemaName: "LeadScout",
    schema: scoutJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });
  if (!output.analysisMd?.trim()) throw new StageError("VALIDATION", "The scout returned an empty analysis — try again.");
  return { result: { ...output, analysisMd: output.analysisMd.trim() }, usage };
}
