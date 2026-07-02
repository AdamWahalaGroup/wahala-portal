/**
 * Discovery Package generator (R2 — docs/brain_storming/synthesis.md).
 *
 * Paste a call transcript / meeting notes onto a deal and the model distills the
 * Discovery Package: the structured record of Jason's Phase 1 — business profile,
 * current workflow, goals, pain points, success metrics, decision makers, budget &
 * timeline, terminology, open questions. "Most of this knowledge is lost after the
 * meeting" — this is where it stops being lost.
 *
 * Output is a single markdown artifact stored on the deal (deals.discovery_md),
 * fully editable by staff, and appended to the org's AI memory when the deal is won.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { STAGE_META } from "@/domain/sales";
import { assertSalesManager } from "@/services/sales";
import { buildAudit } from "@/services/audit";
import { getDraftProvider, type DraftPart, type DraftUsage } from "./provider";
import { resolveAgentConfig } from "./agent-config";

type DiscoveryOutput = { discoveryMd: string };

const discoveryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["discoveryMd"],
  properties: { discoveryMd: { type: "string" } },
} as const;

const SYSTEM_PROMPT = `You are the discovery analyst for Wahala Group, a lean software services firm.
You are given raw material from a sales conversation with a prospect: call transcripts,
meeting notes, and whatever context the salesperson pasted in. Distill it into a
Discovery Package — the durable record of what was learned about the customer's
BUSINESS (not about technology choices).

Return JSON with one field, discoveryMd: a markdown document with EXACTLY these
sections, in this order:

# Discovery — {company name}
## Business profile
What the company does, size, market, how they make money. Terse prose.
## Current workflow
How they operate today, step by step, as described. Bullets.
## Goals
What they are trying to achieve. Bullets.
## Pain points
What hurts today, in their words where possible. Bullets.
## Success metrics
How THEY will judge success. If they never said, write "Not stated — ask." plus your best inference marked (inferred).
## Decision makers
Who decides, who influences, who signs. Include roles even when names are missing.
## Budget & timeline
Anything said about money or dates. If nothing, "Not discussed."
## Terminology
Their words → what they mean. One per line, "term — meaning". Capture THEIR vocabulary; we speak the customer's language back to them.
## Open questions
Bullets. Prefix each with (blocking) if discovery cannot be called complete without the answer, or (nice-to-have) otherwise.

Rules:
- Ground EVERY statement in the source material. Never invent facts. Mark inferences with (inferred).
- Business first: capture the problem and the workflow, not solution or architecture ideas. If the prospect proposed tech ("we want a dashboard"), record the WHY behind it under Goals or Pain points.
- Keep the customer's own phrasing for pain points and terminology — it matters in proposals later.
- Quote numbers exactly (headcounts, volumes, dollar figures, dates).
- Terse and scannable. No filler, no sales fluff, no recommendations.
- If a previous Discovery Package is provided, treat it as the current state: MERGE new
  material into it, keep everything still true, update what changed, and remove an open
  question ONLY when the new material answers it (fold the answer into the right section).`;

export async function generateDiscovery(
  ctx: AuthContext,
  dealId: string,
  input: { pastedText: string },
): Promise<{ discoveryMd: string; usage: DraftUsage }> {
  assertSalesManager(ctx, "generate_discovery");
  const pasted = input.pastedText?.trim();
  if (!pasted) throw new StageError("VALIDATION", "Paste a transcript or notes to distill.");

  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(deal.organizationId)) {
    throw new StageError("NOT_FOUND", "Deal not found.");
  }
  const [org, lead] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }),
    deal.sourceLeadId ? db.query.leads.findFirst({ where: eq(schema.leads.id, deal.sourceLeadId) }) : null,
  ]);
  if (!org) throw new StageError("NOT_FOUND", "Deal not found.");

  // Ground the model with everything the platform already knows about this deal.
  const context: string[] = [
    `Company: ${org.name}`,
    `Deal: ${deal.name} (sales stage: ${STAGE_META[deal.stage].label})`,
  ];
  if (deal.notes) context.push(`Deal notes:\n${deal.notes}`);
  if (lead?.notes || lead?.source) {
    context.push(`Original lead: ${[lead.source && `via ${lead.source}`, lead.notes].filter(Boolean).join(" — ")}`);
  }
  if (org.intakeNotes) context.push(`Intake notes:\n${org.intakeNotes}`);
  if (org.aiContextMd) context.push(`Client memory (client-memory.md):\n${org.aiContextMd}`);

  const parts: DraftPart[] = [{ kind: "text", text: `PLATFORM CONTEXT\n\n${context.join("\n\n")}` }];
  if (deal.discoveryMd?.trim()) {
    parts.push({ kind: "text", text: `PREVIOUS DISCOVERY PACKAGE (merge into this)\n\n${deal.discoveryMd}` });
  }
  parts.push({ kind: "text", text: `NEW SOURCE MATERIAL (transcript / notes)\n\n${pasted}` });

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("discovery");
  const { output, usage } = await provider.completeStructured<DiscoveryOutput>({
    system: SYSTEM_PROMPT,
    parts,
    schemaName: "DiscoveryPackage",
    schema: discoveryJsonSchema,
    model: cfg.model,
    reasoningEffort: cfg.reasoningEffort,
  });

  const discoveryMd = output.discoveryMd.trim();
  if (!discoveryMd) throw new StageError("VALIDATION", "The model returned an empty Discovery Package — try again.");

  await db.batch([
    db.update(schema.deals).set({ discoveryMd }).where(eq(schema.deals.id, dealId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "deal.discovery_generated",
        entityType: "deal",
        entityId: dealId,
        metadata: { model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costCents: usage.costCents },
      }),
    ),
  ]);

  return { discoveryMd, usage };
}
