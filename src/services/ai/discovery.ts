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
    system: cfg.systemPrompt,
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
