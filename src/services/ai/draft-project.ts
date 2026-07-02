/**
 * "Draft a project with AI" — the single-pass draft engine.
 *
 * Authorizes the caller like createProject (admin OR that org's account owner), builds
 * grounding (intake notes + per-client AI memory) + the uploaded source parts, and
 * forwards to the configured AiDraftProvider. No DB writes — the draft is reviewed and
 * edited by the staffer, then persisted by createDraftedProject().
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessOrg } from "@/auth/access";
import { StageError } from "@/domain/stage-machine";
import { securityLog } from "@/lib/security-log";
import { getDraftProvider, type DraftPart, type DraftUsage, type ProjectDraft } from "./provider";
import { resolveAgentConfig } from "./agent-config";

/** Hard cap on total bytes across all files+paste to keep the call cheap and bounded. */
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB


export type DraftInput = {
  organizationId: string;
  files: { name: string; mime: string; bytes: ArrayBuffer }[];
  pastedText?: string;
};

export type DraftOutput = { draft: ProjectDraft; usage: DraftUsage };

function bytesToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const arr = new Uint8Array(buf);
  // Chunk to avoid stack blow-up from String.fromCharCode(...arr).
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) bin += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  return btoa(bin);
}

export async function draftProject(ctx: AuthContext, input: DraftInput): Promise<DraftOutput> {
  // Authorize: admin OR that org's account owner — same RBAC as createProject.
  const db = getDb();
  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.id, input.organizationId),
  });
  if (!org) throw new StageError("NOT_FOUND", "Organization not found.");
  if (!canAccessOrg(ctx.accessScope, org.id)) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "ai_draft_project",
      resource: `org:${org.id}`,
      reason: "out_of_scope",
    });
    throw new StageError("NOT_FOUND", "Organization not found.");
  }
  const isOwner = ctx.user.id === org.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
    securityLog({
      actorUserId: ctx.user.id,
      role: ctx.user.role,
      action: "ai_draft_project",
      resource: `org:${org.id}`,
      reason: "not_admin_or_owner",
    });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or this client's Account Owner can draft a project here.");
  }

  // Convert uploads to typed DraftParts; reject unsupported types up front.
  const parts: DraftPart[] = [];
  let totalBytes = 0;
  for (const f of input.files) {
    totalBytes += f.bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new StageError("VALIDATION", "Uploaded files are too large (8 MB total cap).");
    }
    const mime = (f.mime || "").toLowerCase();
    const lowerName = f.name.toLowerCase();
    if (mime === "text/plain" || mime === "text/markdown" || lowerName.endsWith(".md") || lowerName.endsWith(".txt")) {
      parts.push({ kind: "text", text: `# Source: ${f.name}\n${new TextDecoder().decode(f.bytes)}` });
    } else if (mime.startsWith("image/")) {
      parts.push({ kind: "image", mime: mime || "image/png", b64: bytesToBase64(f.bytes) });
    } else if (mime === "application/pdf" || lowerName.endsWith(".pdf")) {
      parts.push({ kind: "pdf", name: f.name, b64: bytesToBase64(f.bytes) });
    } else {
      throw new StageError(
        "VALIDATION",
        `Unsupported file type for "${f.name}". v1 accepts PDF, images, .txt, .md, or pasted text.`,
      );
    }
  }
  const pasted = input.pastedText?.trim();
  if (pasted) parts.push({ kind: "text", text: `# Pasted notes\n${pasted}` });
  if (parts.length === 0) throw new StageError("VALIDATION", "Provide at least one file or some pasted text to draft from.");

  // Grounding header: who the client is + anything we already know about them.
  const groundingLines = [`# Client: ${org.name}`];
  if (org.intakeNotes?.trim()) groundingLines.push(`## Intake notes (from onboarding)\n${org.intakeNotes.trim()}`);
  if (org.aiContextMd?.trim()) groundingLines.push(`## Existing AI memory for this client\n${org.aiContextMd.trim()}`);
  parts.unshift({ kind: "text", text: groundingLines.join("\n\n") });

  const provider = await getDraftProvider();
  const cfg = await resolveAgentConfig("project_draft");
  return provider.draftProject({ system: cfg.systemPrompt, parts, model: cfg.model, reasoningEffort: cfg.reasoningEffort });
}
