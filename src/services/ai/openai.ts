/**
 * OpenAI implementation of AiDraftProvider. One chat-completions call with strict
 * JSON-schema response_format = guaranteed structured ProjectDraft in a single pass.
 * Multi-modal: text + image_url (base64) + file (base64 PDF) content parts.
 *
 * No SDK dependency — plain fetch — to keep the Worker bundle lean and the swap to a
 * different provider trivial.
 */
import { aiDraftModel, openaiApiKey } from "@/auth/server-env";
import { StageError } from "@/domain/stage-machine";
import type { AiDraftProvider, DraftPart, DraftUsage, ProjectDraft } from "./provider";
import { estimateCostCents, projectDraftJsonSchema } from "./provider";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export class OpenAiDraftProvider implements AiDraftProvider {
  async draftProject(args: { system: string; parts: DraftPart[] }): Promise<{ draft: ProjectDraft; usage: DraftUsage }> {
    const key = openaiApiKey();
    if (!key) {
      throw new StageError(
        "VALIDATION",
        "OPENAI_API_KEY is not configured. Set it in .dev.vars locally or via `wrangler secret put OPENAI_API_KEY` in production.",
      );
    }
    const model = aiDraftModel();

    const content: OpenAiContentPart[] = args.parts.map((p) => {
      if (p.kind === "text") return { type: "text", text: p.text };
      if (p.kind === "image") return { type: "image_url", image_url: { url: `data:${p.mime};base64,${p.b64}` } };
      return { type: "file", file: { filename: p.name, file_data: `data:application/pdf;base64,${p.b64}` } };
    });

    const body = {
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "ProjectDraft", strict: true, schema: projectDraftJsonSchema },
      },
    };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new StageError("VALIDATION", `OpenAI ${res.status}: ${text.slice(0, 400)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw new Error("OpenAI response had no message content.");

    let draft: ProjectDraft;
    try {
      draft = JSON.parse(raw) as ProjectDraft;
    } catch {
      throw new Error("OpenAI response was not valid JSON (despite strict schema).");
    }

    const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(data?.usage?.completion_tokens ?? 0);
    const usage: DraftUsage = {
      model,
      inputTokens,
      outputTokens,
      costCents: estimateCostCents(model, inputTokens, outputTokens),
    };
    return { draft, usage };
  }
}
