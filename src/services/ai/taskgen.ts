/**
 * Engineering task breakdown (R5 — the B-team handoff). "Once they sign off on the
 * statement of work, NOW we get to build the tasks." Given one phase's deliverables
 * (the SOW rows), emit the internal task list the delivery team executes. Tasks are
 * INTERNAL — "we're not gonna give them the tasks, we're gonna give them the story."
 */
import { getDraftProvider, type DraftPart, type DraftUsage } from "./provider";
import { resolveAgentConfig } from "./agent-config";
import { StageError } from "@/domain/stage-machine";

export type GeneratedTask = {
  deliverableIndex: number; // 0-based index into the provided deliverable list; -1 = phase-general
  title: string;
  description: string;
  subtasks: string[];
};

const taskgenJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["deliverableIndex", "title", "description", "subtasks"],
        properties: {
          deliverableIndex: { type: "integer" },
          title: { type: "string" },
          description: { type: "string" },
          subtasks: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;


export async function generateTaskBreakdown(input: {
  phaseName: string;
  scopeDescription: string | null;
  deliverables: { groupLabel: string | null; description: string }[];
  projectDescription: string | null;
  projectContextMd: string | null;
  clientMemoryMd: string | null;
}): Promise<{ tasks: GeneratedTask[]; usage: DraftUsage }> {
  const numbered = input.deliverables
    .map((d, i) => `${i}. [${d.groupLabel ?? "General"}] ${d.description}`)
    .join("\n");

  const context: string[] = [`Phase: ${input.phaseName}`];
  if (input.scopeDescription) context.push(`Phase scope:\n${input.scopeDescription}`);
  if (input.projectDescription) context.push(`Project:\n${input.projectDescription}`);
  if (input.projectContextMd) context.push(`Project context (project-context.md):\n${input.projectContextMd}`);
  if (input.clientMemoryMd) context.push(`Client memory:\n${input.clientMemoryMd}`);

  const parts: DraftPart[] = [
    { kind: "text", text: `CONTEXT\n\n${context.join("\n\n")}` },
    { kind: "text", text: `DELIVERABLES (0-based, reference by index)\n\n${numbered}` },
  ];

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("taskgen");
  const { output, usage } = await provider.completeStructured<{ tasks: GeneratedTask[] }>({
    system: cfg.systemPrompt,
    parts,
    schemaName: "TaskBreakdown",
    schema: taskgenJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });

  const tasks = (output.tasks ?? []).filter(
    (t) => t.title?.trim() && t.deliverableIndex >= -1 && t.deliverableIndex < input.deliverables.length,
  );
  if (tasks.length === 0) throw new StageError("VALIDATION", "The model returned no usable tasks — try again.");
  return { tasks, usage };
}
