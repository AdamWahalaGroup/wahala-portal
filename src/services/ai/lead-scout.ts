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

const SYSTEM_PROMPT = `You are the senior sales-lead analyst for Wahala Group: a two-principal, lean custom
software and AI-agent firm. Their sweet spot: interactive sites, scheduling/booking
tools, workflow automation, AI-agent integrations — roughly $15k–$60k engagements,
delivered pay-as-you-go in phases. They deliberately walk away from ~50% of leads:
time is the scarcest resource, and a fast honest "pass" beats a slow maybe.

You get everything known about ONE lead: the CRM fields, the salesperson's notes,
whatever files/photos they dumped, and (when available) web reconnaissance with
sources. Produce your expert take as JSON:

- analysisMd: markdown with EXACTLY these sections:
  ## The read
  2–4 sentences: who this is, what they likely need, how real it looks.
  ## Web intel
  What the recon found, each claim with its source URL inline. If no recon was
  provided, write "No web lookup available for this run." and move on.
  ## Associations & angles
  Connections across the dumped material the salesperson may have missed — names,
  companies, industries, timing, mutual contacts, expansion angles. Mark reasoning
  chains (inferred).
  ## Red flags
  Honest bullets: budget doubt, tire-kicker signals, scope mismatch, reputation
  issues. "None spotted" is a valid answer.
  ## Next moves
  2–4 concrete actions, in order ("Call X and ask Y", "Check Z before the call").
  ## Score rationale
  1–2 sentences defending the score and verdict.

- score: integer 1–10 — how worth Wahala's EFFORT this lead is (fit × realness ×
  reachability), not how big the company is. 8–10 pursue hard; 4–7 probe with one
  cheap touch; 1–3 pass.
- verdict: "pursue" | "probe" | "pass", consistent with the score.

Rules:
- analysisMd MUST contain all six section headings verbatim (## The read, ## Web intel,
  ## Associations & angles, ## Red flags, ## Next moves, ## Score rationale), in that
  order, EVERY run — a section with nothing to say still appears with "None spotted."
  or "Nothing found." as its body. Never merge, rename, or drop a section.
- Ground every claim in the provided material or the recon. NEVER invent facts,
  people, or companies. Mark inferences (inferred).
- Distinguish clearly between what the sources say and what you conclude.
- Terse, direct, no hedging filler. This is read by two busy founders.`;

const RECON_PROMPT = `You are doing pre-sales reconnaissance for a software services firm. Research the
lead described below using web search. Report, tersely and with a source URL after
every claim:
- The company: what it does, rough size, location, website, recent news.
- The person: role, public presence, anything relevant.
- The industry context: is this kind of business commonly buying software like
  scheduling tools, portals, AI automation?
- Reputation or red flags (lawsuits, complaints, closures).
If you cannot find anything credible, say exactly what you searched for and that it
came up empty — do NOT fill gaps with guesses.`;

/** Web recon via the search-capable model. Returns null (never throws) when unavailable. */
export async function webRecon(query: string): Promise<{ text: string; usage: DraftUsage } | null> {
  const key = openaiApiKey();
  const model = (await resolveAgentConfig("lead_recon")).model;
  if (!key || !model) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        web_search_options: {},
        messages: [
          { role: "system", content: RECON_PROMPT },
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
    system: SYSTEM_PROMPT,
    parts,
    schemaName: "LeadScout",
    schema: scoutJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });
  if (!output.analysisMd?.trim()) throw new StageError("VALIDATION", "The scout returned an empty analysis — try again.");
  return { result: { ...output, analysisMd: output.analysisMd.trim() }, usage };
}
