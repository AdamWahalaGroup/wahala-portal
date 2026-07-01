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

/** Hard cap on total bytes across all files+paste to keep the call cheap and bounded. */
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB

const SYSTEM_PROMPT = `You draft project structures for Wahala Group, a services firm that engages clients in pay-as-you-go FIXED-PRICE PHASES.

Produce a ProjectDraft with:
- name, description (1–3 sentences), workType (free-form category, e.g. "Software engineering", "Brand identity").
- stages: **ONE ENTRY PER PHASE THAT APPEARS IN THE SOURCE.** If the source names or numbers phases ("Phase 1", "Phase 2", "Phase 3", or "Discovery / Build / Launch", etc.), produce that many stages — do NOT stop after the first phase, do NOT collapse multiple phases into one. If the source has no phase breakdown, produce a single stage. Each stage has:
  - name (echo the source's phase name verbatim when given — e.g. "Phase 1 — Private Beta Foundation")
  - scopeDescription (a short client-facing paragraph of what's in scope for this phase)
  - deliverables: an array of { epic, description } pairs. The "epic" field carries a short FOCUS-AREA label shared by multiple deliverables (e.g. "Authentication & Identity", "Org & Tenant Management"). It renders to end users as "Focus area" — the field name is kept as \`epic\` for schema stability. "description" is one concrete client-visible deliverable.
- clientMessage: a short, warm first message to the client in markdown (2–4 short paragraphs).
- projectContextMd: a markdown memo with EXACTLY these sections in this order:
  # {Project Title}
  ## Read
  - one bullet per source document or pasted note you actually read
  ## Inferred
  - what you concluded about the project (goals, audience, scope) from those sources
  ## Assumptions
  - assumptions you had to make (so they can be challenged)
  ## Risks
  - concrete things that could affect delivery — scope creep, integration dependencies, unclear requirements, third-party or external blockers, security/compliance obligations, timeline pressure. Focus on things surfaced by the source docs, not generic project risks. If nothing obvious, write "None identified from the source docs."
  ## Open questions
  - questions the staffer should clarify with the client before sending the quote
  ## Missing information
  - Concrete facts the source docs don't answer that the draft had to guess or skip.
  - Prefix each bullet with **(blocking)** if the draft is materially worse without it, or **(nice-to-have)** if it's just polish.
  - Examples: "(blocking) target launch date not stated", "(nice-to-have) preferred hosting region unclear". If nothing is missing, write a single bullet "None — the source docs were complete."

READING CHECKLIST — before drafting, scan the source docs for each of these categories and let them inform the memo above:
- **Business goals** (the "why" — what outcome the client wants)
- **Functional requirements** (what the system must do)
- **Technical requirements** (constraints or stack decisions the source docs actually state — never invent them)
- **User stories & acceptance criteria** (each story generally maps to one deliverable)
- **Explicit deliverables** (things the source calls out as outputs)
- **Risks & dependencies** (feeds ## Risks)
- **Assumptions & open questions** (feeds ## Assumptions and ## Open questions)

DELIVERABLE RULES (the goal is a clean acceptance checklist the client can tick off):
- **One story per row.** If the source lists "user login" and "session management" as separate stories, produce two separate deliverables — do NOT bundle them as "Secure login and session management".
- **Terse verb-noun naming.** Match the source's terseness: "User registration", "Password reset", "Session management" — not "Secure user registration with email and password verification". 2–5 words per description is the sweet spot.
- **Preserve every focus area the source names.** If the source names 8 focus areas under a phase (e.g. "Authentication & Identity", "Org & Tenant Management", "Matter Persistence", "Audit & Activity Logging", "Administration Controls", "Usage Tracking", "Security Hardening", "Private Beta Deployment"), produce all 8 in that phase's deliverables — do not silently drop focus areas you consider less important.
- Reuse the same focus-area label across related deliverables so they group cleanly under one heading.
- **Merge duplicates.** If the same deliverable appears in more than one source document (e.g. a story in the SOW AND the user-stories doc), emit it ONCE. Cross-reference the sources when you read; don't just concatenate.
- **Consistent terminology.** Use the same word for the same concept across all phases and the memo (e.g. don't call it "matter" in Phase 1 and "case" in Phase 2 — pick the source's word and stick with it).

HARD RULES:
- DO NOT include prices or amounts anywhere. The staffer sets phase prices after this draft.
- DO NOT change or guess the client. The staffer picked the client up front; just use it as context.
- If a later phase in the source has less detail than Phase 1, still emit that phase as its own stage using whatever summary the source gives (its deliverables list can be shorter — never zero).

REDRAFT HONORING (only relevant if the input includes a "Previous draft's project-context.md" block):
- That block contains YOUR prior memo with the staffer's inline edits and answers merged in.
- Treat the staffer's typed text as AUTHORITATIVE. It resolves prior open questions, fills in missing information, and revises any assumption it contradicts. Do NOT ask the same open questions again — remove them from ## Open questions.
- Reflect the newly-known facts throughout the new draft (adjust scope, deliverables, risks, and assumptions accordingly).
- The new memo should note what was answered (fold into ## Inferred or ## Assumptions) rather than repeating a question the staffer has now answered.`;

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
  return provider.draftProject({ system: SYSTEM_PROMPT, parts });
}
