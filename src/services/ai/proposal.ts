/**
 * Proposal generator (R3 — docs/brain_storming/synthesis.md).
 *
 * Drafts the commercial offering from the Discovery Package: an executive summary in
 * the customer's own language, ALWAYS two genuinely different options (A: customer-
 * owned custom build; B: leaner phased/platform path), a complexity read (1–5) with
 * rationale, and the assumptions the offer rests on.
 *
 * HARD RULE carried over from the AI draft feature: the model NEVER prices anything.
 * No dollar figures, no person-weeks. Prices are typed in by an admin afterwards.
 */
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { COMPLEXITY_MAX, COMPLEXITY_MIN } from "@/domain/sales";
import { getDraftProvider, type DraftPart, type DraftUsage } from "./provider";
import { resolveAgentConfig } from "./agent-config";

export type ProposalDraftOutput = {
  title: string;
  executiveSummaryMd: string;
  options: { label: string; name: string; summaryMd: string; timelineNote: string }[];
  complexityScore: number;
  complexityRationale: string;
  assumptionsMd: string;
};

const proposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "executiveSummaryMd", "options", "complexityScore", "complexityRationale", "assumptionsMd"],
  properties: {
    title: { type: "string" },
    executiveSummaryMd: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "name", "summaryMd", "timelineNote"],
        properties: {
          label: { type: "string", enum: ["A", "B"] },
          name: { type: "string" },
          summaryMd: { type: "string" },
          timelineNote: { type: "string" },
        },
      },
    },
    complexityScore: { type: "integer", enum: [1, 2, 3, 4, 5] },
    complexityRationale: { type: "string" },
    assumptionsMd: { type: "string" },
  },
} as const;

const SYSTEM_PROMPT = `You are the proposal writer for Wahala Group, a lean software services firm.
You are given the Discovery Package and context for one deal. Produce the proposal —
the HIGH-LEVEL commercial offering the prospect's decision makers will read. It explains
what we will build, why it solves their problem, and how long it takes. It is NOT a
statement of work: no user stories, no acceptance criteria, no task lists.

ABSOLUTE RULE — NO PRICES. Never output a dollar figure, price range, rate, or effort
estimate in money terms anywhere. Pricing is added by a human afterwards. Timeline
notes are calendar-shaped ("6–8 weeks"), never money-shaped.

Return JSON with:
- title: short proposal title ("<Company> — <what this is>").
- executiveSummaryMd: markdown, 3 short sections: "## The problem" (their pain, in
  their own words — reuse the Terminology section of the discovery), "## What success
  looks like" (their goals/success metrics), "## Our approach" (2–4 sentences, plain
  business language, no jargon).
- options: EXACTLY two entries, labels "A" and "B", genuinely different commercial
  shapes — not the same scope at two price points:
  * A — the customer-owned custom build: they own everything, fuller scope, longer.
  * B — the leaner path: phased delivery starting with the highest-pain slice, or
    built on reusable platform pieces; faster start, smaller commitment, may imply a
    recurring platform relationship.
  Each option: name (7 words max), summaryMd (markdown: "### What you get" bullets
  grounded in discovery, "### Why this option" 1–2 sentences, "### Trade-offs" 1–2
  honest bullets), timelineNote ("~6–8 weeks" style).
- complexityScore: integer 1–5 for the OVERALL engagement. 1–2 = simple site/CRUD/
  integration wrapper; 3 = moderate multi-feature build; 4 = heavy integrations,
  agentic AI behavior, data migration, or regulated data (HIPAA etc.); 5 = all of it
  at once. Score honestly — above 3 routes this to engineering review.
- complexityRationale: 1–3 sentences naming the drivers of the score.
- assumptionsMd: markdown bullets — what this offer assumes is true (access, existing
  systems, decision timeline, content provided by customer…). Grounded, not boilerplate.

Rules:
- Ground everything in the provided material. Never invent capabilities, systems, or
  facts. Mark unavoidable inferences with (inferred).
- Speak the customer's language: reuse their terminology from discovery verbatim.
- Terse, confident, concrete. No filler ("we are excited to…"), no superlatives.`;

/** Compose grounded parts + call the provider. Pure AI step — persistence lives in services/proposals.ts. */
export async function draftProposal(
  _ctx: AuthContext,
  input: {
    orgName: string;
    dealName: string;
    dealNotes: string | null;
    discoveryMd: string | null;
    clientMemoryMd: string | null;
    previousProposalMd: string | null; // exec summary + options of the version being replaced
  },
): Promise<{ draft: ProposalDraftOutput; usage: DraftUsage }> {
  const context: string[] = [`Company: ${input.orgName}`, `Deal: ${input.dealName}`];
  if (input.dealNotes) context.push(`Deal notes:\n${input.dealNotes}`);
  if (input.clientMemoryMd) context.push(`Client memory (client-memory.md):\n${input.clientMemoryMd}`);

  const parts: DraftPart[] = [{ kind: "text", text: `PLATFORM CONTEXT\n\n${context.join("\n\n")}` }];
  if (input.discoveryMd?.trim()) {
    parts.push({ kind: "text", text: `DISCOVERY PACKAGE\n\n${input.discoveryMd}` });
  } else {
    parts.push({
      kind: "text",
      text: "DISCOVERY PACKAGE\n\n(None captured yet — ground the proposal in the deal notes and client memory only, and say so in assumptionsMd.)",
    });
  }
  if (input.previousProposalMd?.trim()) {
    parts.push({
      kind: "text",
      text: `PREVIOUS PROPOSAL VERSION (being rewritten — improve on it, keep what the client already reacted well to)\n\n${input.previousProposalMd}`,
    });
  }

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("proposal");
  const { output, usage } = await provider.completeStructured<ProposalDraftOutput>({
    system: SYSTEM_PROMPT,
    parts,
    schemaName: "ProposalDraft",
    schema: proposalJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });

  if (!Array.isArray(output.options) || output.options.length !== 2) {
    throw new StageError("VALIDATION", "The model did not return exactly two options — try again.");
  }
  if (output.complexityScore < COMPLEXITY_MIN || output.complexityScore > COMPLEXITY_MAX) {
    throw new StageError("VALIDATION", "The model returned an out-of-range complexity score — try again.");
  }
  return { draft: output, usage };
}
