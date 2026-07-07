/**
 * Proposal prose writer (HANDOFF-DELTA-2026-07-07) — the AI half of the hybrid
 * "Rough out a draft": deterministic math (src/domain/proposal-math.ts) owns the
 * option shapes, prices, phase splits, and complexity; this call writes ONLY the
 * client-facing prose — exec summary, option names, phase names.
 *
 * HARD RULE: the model NEVER prices anything. Shapes are passed as structural
 * context (no amounts) and the schema has nowhere to put a number.
 */
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { getDraftProvider, type DraftPart, type DraftUsage } from "./provider";
import { resolveAgentConfig } from "./agent-config";

export type ProposalProseOutput = {
  execSummary: string;
  options: { label: string; name: string; phaseNames: string[] }[];
};

const proseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["execSummary", "options"],
  properties: {
    execSummary: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "name", "phaseNames"],
        properties: {
          label: { type: "string" },
          name: { type: "string" },
          phaseNames: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export type ProposalShape = {
  label: string;
  name: string; // the deterministic default name — the model may improve it
  phased: boolean;
  phaseCount: number;
  timelineNote: string;
};

/** One structured call; throws on out-of-shape output (caller falls back wholesale). */
export async function draftProposalProse(
  _ctx: AuthContext,
  input: {
    orgName: string;
    dealName: string;
    discoveryNote: string | null;
    discoveryMd: string | null;
    clientMemoryMd: string | null;
    weightingNote: string | null;
    shapes: ProposalShape[];
  },
): Promise<{ output: ProposalProseOutput; usage: DraftUsage }> {
  const context: string[] = [`Company: ${input.orgName}`, `Deal: ${input.dealName}`];
  if (input.discoveryNote?.trim()) context.push(`Discovery note (what we actually learned about their need):\n${input.discoveryNote}`);
  if (input.clientMemoryMd?.trim()) context.push(`Client memory (client-memory.md):\n${input.clientMemoryMd}`);
  if (input.weightingNote?.trim()) context.push(`The salesperson asked to weight this in the framing:\n${input.weightingNote}`);

  const shapeLines = input.shapes
    .map((s) => `- Option ${s.label}: "${s.name}" — ${s.phased ? `phased (${s.phaseCount} phases)` : "single delivery"} · ${s.timelineNote}`)
    .join("\n");

  const parts: DraftPart[] = [
    { kind: "text", text: `CONTEXT\n\n${context.join("\n\n")}` },
    input.discoveryMd?.trim()
      ? { kind: "text", text: `DISCOVERY PACKAGE (long form)\n\n${input.discoveryMd}` }
      : { kind: "text", text: "DISCOVERY PACKAGE\n\n(None captured yet — ground the summary in the discovery note and client memory only.)" },
    {
      kind: "text",
      text: `OPTION SHAPES (fixed by the salesperson + pricing math — do NOT change the structure, only write names)\n\n${shapeLines}\n\nReturn one options entry per shape, same labels, in order. phaseNames must have exactly the phase count for phased options and be [] for single-delivery options.`,
    },
  ];

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("proposal");
  const { output, usage } = await provider.completeStructured<ProposalProseOutput>({
    system: cfg.systemPrompt,
    parts,
    schemaName: "ProposalProse",
    schema: proseJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });

  if (!Array.isArray(output.options) || output.options.length !== input.shapes.length) {
    throw new StageError("VALIDATION", "The model did not return one entry per option shape.");
  }
  if (!output.execSummary?.trim()) {
    throw new StageError("VALIDATION", "The model returned an empty summary.");
  }
  return { output, usage };
}
