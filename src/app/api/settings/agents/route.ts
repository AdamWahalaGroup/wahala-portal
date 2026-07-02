/**
 * GET /api/settings/agents — every AI agent with its effective model + reasoning
 * PUT /api/settings/agents — { agentKey, model, reasoningEffort } (empty = default)
 * Wahala admin only.
 */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson, ApiError } from "@/lib/api";
import { AGENT_DEFS, resolveAgentConfig, saveAgentConfig } from "@/services/ai/agent-config";

export const dynamic = "force-dynamic";

function assertAdmin(ctx: { isAdmin: boolean }) {
  if (!ctx.isAdmin) throw new ApiError(403, "forbidden", "Wahala admin only.");
}

export async function GET() {
  try {
    const ctx = await requireAuth();
    assertAdmin(ctx);
    const agents = await Promise.all(
      AGENT_DEFS.map(async (d) => {
        const cfg = await resolveAgentConfig(d.key);
        return {
          key: d.key,
          label: d.label,
          description: d.description,
          supportsReasoning: d.supportsReasoning,
          defaultModel: d.defaultModel(),
          model: cfg.model,
          reasoningEffort: cfg.reasoningEffort,
          overridden: cfg.overridden,
        };
      }),
    );
    return NextResponse.json({ agents });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await requireAuth();
    assertAdmin(ctx);
    const body = await readJson<{ agentKey?: string; model?: string; reasoningEffort?: string }>(req);
    if (!body.agentKey || !AGENT_DEFS.some((d) => d.key === body.agentKey)) {
      throw new ApiError(400, "validation", "Unknown agentKey.");
    }
    await saveAgentConfig(body.agentKey, { model: body.model ?? "", reasoningEffort: body.reasoningEffort ?? "" }, ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
