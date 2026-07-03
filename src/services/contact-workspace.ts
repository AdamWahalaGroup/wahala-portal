/**
 * Contact workspace — the per-contact dump zone + AI scout (successor to the lead
 * workspace: contacts absorbed leads; "lead" is just the to_qualify state).
 *
 * Any staff can drop files/photos/content onto a contact (bytes in R2 under
 * contacts/<contactId>/…, metadata in contact_assets — always internal, clients never
 * see triage). The scout run (admin/account owner, it costs money) feeds the CRM
 * record, the notes, the dump, and live web recon to the AI sales expert and stores
 * the opinion + 1–10 score + pursue/probe/pass verdict on the contact.
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

async function loadContact(ctx: AuthContext, contactId: string, action: string) {
  assertStaff(ctx, action);
  const contact = await getDb().query.contacts.findFirst({ where: eq(schema.contacts.id, contactId) });
  if (!contact) throw new StageError("NOT_FOUND", "Contact not found.");
  return contact;
}

// ---------------------------------------------------------------- files

export type ContactFileView = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploaderName: string | null;
  createdAt: Date;
};

export async function listContactFiles(ctx: AuthContext, contactId: string): Promise<ContactFileView[]> {
  await loadContact(ctx, contactId, "list_contact_files");
  const db = getDb();
  const rows = await db.select().from(schema.contactAssets).where(eq(schema.contactAssets.contactId, contactId)).orderBy(desc(schema.contactAssets.createdAt));
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

/** Any staff can dump a file onto a contact. */
export async function uploadContactFile(
  ctx: AuthContext,
  contactId: string,
  file: { fileName: string; mimeType: string | null; bytes: ArrayBuffer },
): Promise<{ id: string }> {
  await loadContact(ctx, contactId, "upload_contact_file");
  const fileName = file.fileName?.trim();
  if (!fileName) throw new StageError("VALIDATION", "File name is required.");
  if (file.bytes.byteLength === 0) throw new StageError("VALIDATION", `"${fileName}" is empty.`);
  if (file.bytes.byteLength > MAX_BYTES) throw new StageError("VALIDATION", `"${fileName}" is over the 25 MB limit.`);

  const id = crypto.randomUUID();
  const r2Key = `contacts/${contactId}/${id}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
  await r2().put(r2Key, file.bytes, { httpMetadata: file.mimeType ? { contentType: file.mimeType } : undefined });
  await getDb().insert(schema.contactAssets).values({
    id,
    contactId,
    fileName,
    r2Key,
    mimeType: file.mimeType,
    sizeBytes: file.bytes.byteLength,
    uploadedByUserId: ctx.user.id,
  });
  return { id };
}

export async function getContactFileBody(
  ctx: AuthContext,
  contactId: string,
  fileId: string,
): Promise<{ body: ReadableStream; fileName: string; mimeType: string | null }> {
  await loadContact(ctx, contactId, "download_contact_file");
  const db = getDb();
  const row = await db.query.contactAssets.findFirst({ where: eq(schema.contactAssets.id, fileId) });
  if (!row || row.contactId !== contactId) throw new StageError("NOT_FOUND", "File not found.");
  const obj = await r2().get(row.r2Key);
  if (!obj) throw new StageError("NOT_FOUND", "File body missing from storage.");
  return { body: obj.body, fileName: row.fileName, mimeType: row.mimeType };
}

/** Delete a dumped file (admin / account owner). */
export async function deleteContactFile(ctx: AuthContext, contactId: string, fileId: string): Promise<void> {
  assertSalesManager(ctx, "delete_contact_file");
  await loadContact(ctx, contactId, "delete_contact_file");
  const db = getDb();
  const row = await db.query.contactAssets.findFirst({ where: eq(schema.contactAssets.id, fileId) });
  if (!row || row.contactId !== contactId) throw new StageError("NOT_FOUND", "File not found.");
  await r2().delete(row.r2Key);
  await db.delete(schema.contactAssets).where(eq(schema.contactAssets.id, fileId));
}

// ---------------------------------------------------------------- detail + edit

export type ContactDetail = {
  id: string;
  name: string;
  companyNote: string | null;
  organizationId: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  state: "to_qualify" | "qualified" | "passed";
  estValueCents: number;
  assignedToUserId: string | null;
  assignedToName: string | null;
  aiAnalysisMd: string | null;
  aiScore: number | null;
  aiVerdict: "pursue" | "probe" | "pass" | null;
  aiAnalyzedAt: Date | null;
  createdAt: Date;
  files: ContactFileView[];
  /** Latest deal referencing this contact (the "View the deal →" link). */
  linkedDealId: string | null;
};

export async function getContactDetail(ctx: AuthContext, contactId: string): Promise<ContactDetail> {
  const contact = await loadContact(ctx, contactId, "get_contact_detail");
  const db = getDb();
  const [files, assignee, org, linkedDeal] = await Promise.all([
    listContactFiles(ctx, contactId),
    contact.assignedToUserId ? db.query.users.findFirst({ where: eq(schema.users.id, contact.assignedToUserId) }) : null,
    contact.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, contact.organizationId) }) : null,
    db.query.deals.findFirst({ where: eq(schema.deals.primaryContactId, contactId), orderBy: desc(schema.deals.createdAt) }),
  ]);
  return {
    id: contact.id,
    name: contact.name,
    companyNote: contact.companyNote,
    organizationId: contact.organizationId,
    organizationName: org?.name ?? null,
    email: contact.email,
    phone: contact.phone,
    source: contact.source,
    notes: contact.notes,
    state: contact.state,
    estValueCents: contact.estValueCents,
    assignedToUserId: contact.assignedToUserId,
    assignedToName: assignee?.name ?? null,
    aiAnalysisMd: contact.aiAnalysisMd,
    aiScore: contact.aiScore,
    aiVerdict: contact.aiVerdict,
    aiAnalyzedAt: contact.aiAnalyzedAt,
    createdAt: contact.createdAt,
    files,
    linkedDealId: linkedDeal?.id ?? null,
  };
}

/** Any staff can enrich the record — same tier as capturing it. */
export async function updateContactFields(
  ctx: AuthContext,
  contactId: string,
  input: { name?: string; companyNote?: string; email?: string; phone?: string; source?: string; notes?: string },
): Promise<void> {
  await loadContact(ctx, contactId, "update_contact_fields");
  const patch: Partial<typeof schema.contacts.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new StageError("VALIDATION", "A contact needs at least a name.");
    patch.name = n;
  }
  if (input.companyNote !== undefined) patch.companyNote = input.companyNote.trim() || null;
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase() || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.source !== undefined) patch.source = input.source.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
  if (Object.keys(patch).length === 0) return;
  await getDb().update(schema.contacts).set(patch).where(eq(schema.contacts.id, contactId));
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

/** Run the AI scout: web recon + synthesis over the whole dump. Admin / account owner. */
export async function analyzeContact(
  ctx: AuthContext,
  contactId: string,
): Promise<{ analysisMd: string; score: number; verdict: string; usage: DraftUsage; webUsed: boolean }> {
  assertSalesManager(ctx, "analyze_contact");
  const contact = await loadContact(ctx, contactId, "analyze_contact");
  const db = getDb();
  const [assets, org] = await Promise.all([
    db.select().from(schema.contactAssets).where(eq(schema.contactAssets.contactId, contactId)),
    contact.organizationId ? db.query.organizations.findFirst({ where: eq(schema.organizations.id, contact.organizationId) }) : null,
  ]);

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

  const company = org?.name ?? contact.companyNote;
  const summaryLines = [
    `Name: ${contact.name}`,
    company && `Company: ${company}`,
    contact.source && `Source: ${contact.source}`,
    contact.email && `Email: ${contact.email}`,
    contact.phone && `Phone: ${contact.phone}`,
    contact.estValueCents > 0 && `Estimated value (gut call): $${Math.round(contact.estValueCents / 100).toLocaleString("en-US")}`,
    `Captured: ${contact.createdAt.toISOString().slice(0, 10)}`,
    contact.notes && `Salesperson notes:\n${contact.notes}`,
  ].filter(Boolean) as string[];

  // Recon only when there's something concrete to search for.
  const query = [contact.name, company].filter(Boolean).join(" — ");
  const recon = company ? await webRecon(query) : null;

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

  await db.update(schema.contacts).set({
    aiAnalysisMd: result.analysisMd,
    aiScore: result.score,
    aiVerdict: result.verdict,
    aiAnalyzedAt: new Date(),
  }).where(eq(schema.contacts.id, contactId));
  // No audit row: audit_log requires an organization id and triage contacts may be
  // pre-account. aiAnalyzedAt + the stored markdown are the record of the run.

  return { analysisMd: result.analysisMd, score: result.score, verdict: result.verdict, usage: totalUsage, webUsed: !!recon };
}
