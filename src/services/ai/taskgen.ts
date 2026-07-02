/**
 * Engineering task breakdown (R5 — the B-team handoff). "Once they sign off on the
 * statement of work, NOW we get to build the tasks." Given one phase's deliverables
 * (the SOW rows), emit the internal task list the delivery team executes. Tasks are
 * INTERNAL — "we're not gonna give them the tasks, we're gonna give them the story."
 */
import { getDraftProvider, type DraftPart, type DraftUsage } from "./provider";
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

const SYSTEM_PROMPT = `You are the engineering lead at Wahala Group breaking a signed statement of work
into the internal task list a delivery engineer (who was NOT in the sales calls)
will execute. The engineer has the project context but none of the tribal knowledge —
each task must stand alone.

You get ONE phase: its scope, and a numbered list of deliverables (grouped by focus
area). Return JSON: tasks, each with:
- deliverableIndex: the 0-based number of the deliverable it implements, or -1 for
  phase-general work (project setup, environments, CI, deploy) that serves them all.
- title: terse, verb-first, ≤ 9 words ("Build magic-link auth endpoint").
- description: 1–3 sentences of WHAT and any constraint the sources state. Write for
  the engineer; do not restate the title.
- subtasks: 2–6 concrete steps, each ≤ 12 words, in execution order.

Rules:
- EVERY deliverable gets at least one task; split a deliverable into multiple tasks
  when it clearly contains distinct engineering pieces.
- Include phase-general tasks (index -1) only when genuinely needed, and at most 3.
- Ground everything in the provided material — never invent features, integrations,
  or tech choices the sources don't support. Mark unavoidable inferences (inferred).
- NO time estimates, NO prices, NO story points.
- Terse and concrete. No filler.`;

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
  const { output, usage } = await provider.completeStructured<{ tasks: GeneratedTask[] }>({
    system: SYSTEM_PROMPT,
    parts,
    schemaName: "TaskBreakdown",
    schema: taskgenJsonSchema,
  });

  const tasks = (output.tasks ?? []).filter(
    (t) => t.title?.trim() && t.deliverableIndex >= -1 && t.deliverableIndex < input.deliverables.length,
  );
  if (tasks.length === 0) throw new StageError("VALIDATION", "The model returned no usable tasks — try again.");
  return { tasks, usage };
}
