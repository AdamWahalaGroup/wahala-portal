/**
 * Lead workspace — the per-lead dump zone + AI scout.
 *
 * Any staff can drop files/photos/content onto a lead (bytes in R2 under
 * leads/<leadId>/…, metadata in lead_assets — always internal, clients never see
 * leads at all). The scout run (admin/account owner, it costs money) feeds the CRM
 * record, the notes, the dump, and live web recon to the AI sales-lead expert and
 * stores the opinion + 1–10 score + pursue/probe/pass verdict on the lead.
 */
import { desc, eq, inArray } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager } from "@/services/sales";
import { webRecon, scoutLead } from "@/services/ai/lead-scout";
import { securityLog } from "@/lib/security-log";
import type { DraftPart, DraftUsage } from "@/services/ai/provider";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file (upload cap, same as project files)
const AI_IMAGE_CAP = 4 * 1024 * 1024; // per-file caps for what gets FED to the model
const AI_PDF_CAP = 10 * 1024 * 1024;
const AI_TEXT_CAP = 100 * 1024;

function r2() {
  return getCloudflareContext().env.FILES;
}

function assertStaff(ctx: AuthContext, action: string): void {
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Wahala staff only.");
  }
}

async function loadLead(ctx: AuthContext, leadId: string, action: string) {
  assertStaff(ctx, action);
  const lead = await getDb().query.leads.findFirst({ where: eq(schema.leads.id, leadId) });
  if (!lead) throw new StageError("NOT_FOUND", "Lead not found.");
  return lead;
}

// ---------------------------------------------------------------- files

export type LeadFileView = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploaderName: string | null;
  createdAt: Date;
};

export async function listLeadFiles(ctx: AuthContext, leadId: string): Promise<LeadFileView[]> {
  await loadLead(ctx, leadId, "list_lead_files");
  const db = getDb();
  const rows = await db.select().from(schema.leadAssets).where(eq(schema.leadAssets.leadId, leadId)).orderBy(desc(schema.leadAssets.createdAt));
  const uploaderIds = [...new Set(rows.map((r) => r.uploadedByUserId).filter((v): v is string => !!v))];
  const users = uploaderIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, uploaderIds))
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    uploaderName: r.uploadedByUserId ? nameById.get(r.uploadedByUserId) ?? null : null,
    createdAt: r.createdAt,
  }));
}

/** Any staff can dump a file onto a lead. */
export async function uploadLeadFile(
  ctx: AuthContext,
  leadId: string,
  file: { fileName: string; mimeType: string | null; bytes: ArrayBuffer },
): Promise<{ id: string }> {
  await loadLead(ctx, leadId, "upload_lead_file");
  const fileName = file.fileName?.trim();
  if (!fileName) throw new StageError("VALIDATION", "File name is required.");
  if (file.bytes.byteLength === 0) throw new StageError("VALIDATION", `"${fileName}" is empty.`);
  if (file.bytes.byteLength > MAX_BYTES) throw new StageError("VALIDATION", `"${fileName}" is over the 25 MB limit.`);

  const id = crypto.randomUUID();
  const r2Key = `leads/${leadId}/${id}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
  await r2().put(r2Key, file.bytes, { httpMetadata: file.mimeType ? { contentType: file.mimeType } : undefined });
  await getDb().insert(schema.leadAssets).values({
    id,
    leadId,
    fileName,
    r2Key,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.byteLength,
    uploadedByUserId: ctx.user.id,
  });
  return { id };
}

export async function getLeadFileBody(
  ctx: AuthContext,
  leadId: string,
  fileId: string,
): Promise<{ body: ReadableStream; fileName: string; mimeType: string | null }> {
  await loadLead(ctx, leadId, "download_lead_file");
  const db = getDb();
  const row = await db.query.leadAssets.findFirst({ where: eq(schema.leadAssets.id, fileId) });
  if (!row || row.leadId !== leadId) throw new StageError("NOT_FOUND", "File not found.");
  const obj = await r2().get(row.r2Key);
  if (!obj) throw new StageError("NOT_FOUND", "File body missing from storage.");
  return { body: obj.body, fileName: row.fileName, mimeType: row.mimeType };
}

/** Delete a dumped file (admin / account owner). */
export async function deleteLeadFile(ctx: AuthContext, leadId: string, fileId: string): Promise<void> {
  assertSalesManager(ctx, "delete_lead_file");
  await loadLead(ctx, leadId, "delete_lead_file");
  const db = getDb();
  const row = await db.query.leadAssets.findFirst({ where: eq(schema.leadAssets.id, fileId) });
  if (!row || row.leadId !== leadId) throw new StageError("NOT_FOUND", "File not found.");
  await r2().delete(row.r2Key);
  await db.delete(schema.leadAssets).where(eq(schema.leadAssets.id, fileId));
}

// ---------------------------------------------------------------- detail + edit

export type LeadDetail = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  industry: string | null;
  notes: string | null;
  status: "new" | "qualified" | "disqualified";
  assignedToUserId: string | null;
  assignedToName: string | null;
  convertedDealId: string | null;
  aiAnalysisMd: string | null;
  aiScore: number | null;
  aiVerdict: "pursue" | "probe" | "pass" | null;
  aiAnalyzedAt: Date | null;
  createdAt: Date;
  files: LeadFileView[];
};

export async function getLeadDetail(ctx: AuthContext, leadId: string): Promise<LeadDetail> {
  const lead = await loadLead(ctx, leadId, "get_lead_detail");
  const db = getDb();
  const [files, assignee] = await Promise.all([
    listLeadFiles(ctx, leadId),
    lead.assignedToUserId ? db.query.users.findFirst({ where: eq(schema.users.id, lead.assignedToUserId) }) : null,
  ]);
  return {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    industry: lead.industry,
    notes: lead.notes,
    status: lead.status,
    assignedToUserId: lead.assignedToUserId,
    assignedToName: assignee?.name ?? null,
    convertedDealId: lead.convertedDealId,
    aiAnalysisMd: lead.aiAnalysisMd,
    aiScore: lead.aiScore,
    aiVerdict: lead.aiVerdict,
    aiAnalyzedAt: lead.aiAnalyzedAt,
    createdAt: lead.createdAt,
    files,
  };
}

/** Any staff can enrich the record — same tier as capturing it. */
export async function updateLeadFields(
  ctx: AuthContext,
  leadId: string,
  input: { name?: string; company?: string; email?: string; phone?: string; source?: string; industry?: string; notes?: string },
): Promise<void> {
  await loadLead(ctx, leadId, "update_lead");
  const patch: Partial<typeof schema.leads.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new StageError("VALIDATION", "A lead needs at least a name.");
    patch.name = n;
  }
  if (input.company !== undefined) patch.company = input.company.trim() || null;
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.source !== undefined) patch.source = input.source.trim() || null;
  if (input.industry !== undefined) patch.industry = input.industry.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (Object.keys(patch).length === 0) return;
  await getDb().update(schema.leads).set(patch).where(eq(schema.leads.id, leadId));
}

// ---------------------------------------------------------------- the scout run

function bytesToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const arr = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) bin += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  return btoa(bin);
}

const TEXTUAL = /^(text\/|application\/(json|xml|csv))/;

/** Run the AI lead scout: web recon + synthesis over the whole dump. Admin / account owner. */
export async function analyzeLead(
  ctx: AuthContext,
  leadId: string,
): Promise<{ analysisMd: string; score: number; verdict: string; usage: DraftUsage; webUsed: boolean }> {
  assertSalesManager(ctx, "analyze_lead");
  const lead = await loadLead(ctx, leadId, "analyze_lead");
  const db = getDb();
  const assets = await db.select().from(schema.leadAssets).where(eq(schema.leadAssets.leadId, leadId));

  // Convert the dump into model parts — images/PDFs as-is, text as text; cap sizes.
  const fileParts: DraftPart[] = [];
  const skipped: string[] = [];
  for (const a of assets) {
    const mime = a.mimeType ?? "";
    const size = a.sizeBytes ?? 0;
    const feedable =
      (mime.startsWith("image/") && size <= AI_IMAGE_CAP) ||
      (mime === "application/pdf" && size <= AI_PDF_CAP) ||
      (TEXTUAL.test(mime) && size <= AI_TEXT_CAP);
    if (!feedable) {
      skipped.push(a.fileName);
      continue;
    }
    const obj = await r2().get(a.r2Key);
    if (!obj) {
      skipped.push(a.fileName);
      continue;
    }
    const bytes = await obj.arrayBuffer();
    if (mime.startsWith("image/")) fileParts.push({ kind: "image", mime, b64: bytesToBase64(bytes) });
    else if (mime === "application/pdf") fileParts.push({ kind: "pdf", name: a.fileName, b64: bytesToBase64(bytes) });
    else fileParts.push({ kind: "text", text: `FILE ${a.fileName}:\n${new TextDecoder().decode(bytes)}` });
  }

  const summaryLines = [
    `Name: ${lead.name}`,
    lead.company && `Company: ${lead.company}`,
    lead.industry && `Industry: ${lead.industry}`,
    lead.source && `Source: ${lead.source}`,
    lead.email && `Email: ${lead.email}`,
    lead.phone && `Phone: ${lead.phone}`,
    `Captured: ${lead.createdAt.toISOString().slice(0, 10)}`,
    lead.notes && `Salesperson notes:\n${lead.notes}`,
  ].filter(Boolean) as string[];

  // Recon only when there's something concrete to search for.
  const query = [lead.name, lead.company, lead.industry].filter(Boolean).join(" — ");
  const recon = lead.company || lead.industry ? await webRecon(query) : null;

  const { result, usage } = await scoutLead({
    leadSummary: summaryLines.join("\n"),
    reconText: recon?.text ?? null,
    fileParts,
    skippedFiles: skipped,
  });

  const totalUsage: DraftUsage = {
    model: usage.model,
    inputTokens: usage.inputTokens + (recon?.usage.inputTokens ?? 0),
    outputTokens: usage.outputTokens + (recon?.usage.outputTokens ?? 0),
    costCents: usage.costCents + (recon?.usage.costCents ?? 0),
  };

  await db.update(schema.leads).set({
    aiAnalysisMd: result.analysisMd,
    aiScore: result.score,
    aiVerdict: result.verdict,
    aiAnalyzedAt: new Date(),
  }).where(eq(schema.leads.id, leadId));
  // No audit row: audit_log requires an organization id and leads are pre-org.
  // aiAnalyzedAt + the stored markdown are the record of the run.

  return { analysisMd: result.analysisMd, score: result.score, verdict: result.verdict, usage: totalUsage, webUsed: !!recon };
}
