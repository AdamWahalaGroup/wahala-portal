/**
 * Files / assets — project attachments stored in Cloudflare R2, metadata in D1.
 *
 * Staff upload (and choose visibility); everyone in scope can download what they're
 * allowed to see. Clients are read-only and NEVER see internal-flagged files
 * (recordings, AI analyses) — the same visibility rule as tasks, enforced here.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessOrg, canAccessProject } from "@/auth/access";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function r2() {
  return getCloudflareContext().env.FILES;
}

function extOf(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,6})$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

function typeFor(mime: string | null): "image" | "recording" | "document" | "other" {
  if (!mime) return "other";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "recording";
  if (mime === "application/pdf" || mime.startsWith("text/")) return "document";
  return "other";
}

async function loadProjectScoped(ctx: AuthContext, projectId: string) {
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");
  if (!canAccessProject(ctx.accessScope, { id: project.id, organizationId: project.organizationId })) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "load_project_files", resource: `project:${projectId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Project not found.");
  }
  return project;
}

function canAccessAsset(ctx: AuthContext, asset: { projectId: string | null; organizationId: string }): boolean {
  return asset.projectId
    ? canAccessProject(ctx.accessScope, { id: asset.projectId, organizationId: asset.organizationId })
    : canAccessOrg(ctx.accessScope, asset.organizationId);
}

export type FileView = {
  id: string;
  fileName: string;
  ext: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: "client_visible" | "internal";
  uploaderName: string | null;
  createdAt: Date;
};

/** Files on a project — visibility-scoped (clients never see internal files). */
/**
 * All client-visible files across the client's org, newest first — the client
 * Files page (QA delta 07-08 §5: every nav item routes to a real page).
 */
export async function listClientFiles(ctx: AuthContext): Promise<(FileView & { projectName: string | null })[]> {
  if (ctx.isStaff || !ctx.organizationId) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.organizationId, ctx.organizationId), eq(schema.assets.visibility, "client_visible")))
    .orderBy(desc(schema.assets.createdAt));
  if (rows.length === 0) return [];
  const projectIds = [...new Set(rows.map((r) => r.projectId).filter((v): v is string => !!v))];
  const projects = projectIds.length
    ? await db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).where(inArray(schema.projects.id, projectIds))
    : [];
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    ext: extOf(r.fileName),
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    visibility: r.visibility,
    createdAt: r.createdAt,
    uploaderName: null,
    projectName: r.projectId ? nameOf.get(r.projectId) ?? null : null,
  }));
}

export async function listFilesForProject(ctx: AuthContext, projectId: string): Promise<FileView[]> {
  await loadProjectScoped(ctx, projectId);
  const db = getDb();

  const conds = [eq(schema.assets.projectId, projectId)];
  if (!ctx.canSeeInternal) conds.push(eq(schema.assets.visibility, "client_visible"));
  const rows = await db.select().from(schema.assets).where(and(...conds)).orderBy(desc(schema.assets.createdAt));
  if (rows.length === 0) return [];

  const uploaderIds = [...new Set(rows.map((r) => r.uploadedByUserId).filter(Boolean))] as string[];
  const users = uploaderIds.length
    ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, uploaderIds))
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    ext: extOf(r.fileName),
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    visibility: r.visibility as "client_visible" | "internal",
    uploaderName: r.uploadedByUserId ? nameById.get(r.uploadedByUserId) ?? null : null,
    createdAt: r.createdAt,
  }));
}

/** Upload a file to a project (staff only). */
export async function uploadFile(
  ctx: AuthContext,
  input: { projectId: string; file: File; visibility?: string },
): Promise<void> {
  const project = await loadProjectScoped(ctx, input.projectId);
  if (!ctx.isStaff) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "upload_file", resource: `project:${input.projectId}`, reason: "not_staff" });
    throw new StageError("FORBIDDEN", "Only Wahala staff can upload files.");
  }
  const file = input.file;
  if (!file || !file.name) throw new StageError("VALIDATION", "A file is required.");
  if (file.size > MAX_BYTES) throw new StageError("VALIDATION", "File too large (max 25 MB).");

  const visibility = input.visibility === "internal" ? "internal" : "client_visible";
  const assetId = crypto.randomUUID();
  const r2Key = `assets/${assetId}`;

  await r2().put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const db = getDb();
  await db.batch([
    db.insert(schema.assets).values({
      id: assetId,
      organizationId: project.organizationId,
      projectId: project.id,
      uploadedByUserId: ctx.user.id,
      fileName: file.name,
      r2Key,
      mimeType: file.type || null,
      sizeBytes: file.size,
      type: typeFor(file.type || null),
      visibility,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: project.organizationId,
        actorUserId: ctx.user.id,
        action: "file.uploaded",
        entityType: "asset",
        entityId: assetId,
        metadata: { fileName: file.name, visibility },
      }),
    ),
  ]);
}

/** Resolve a downloadable asset (access + visibility checked) + its R2 object. */
export async function getAssetForDownload(ctx: AuthContext, assetId: string) {
  const db = getDb();
  const asset = await db.query.assets.findFirst({ where: eq(schema.assets.id, assetId) });
  if (!asset) throw new StageError("NOT_FOUND", "File not found.");

  if (!canAccessAsset(ctx, asset) || (!ctx.canSeeInternal && asset.visibility === "internal")) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "download_file", resource: `asset:${assetId}`, reason: "not_visible" });
    throw new StageError("NOT_FOUND", "File not found.");
  }

  const object = await r2().get(asset.r2Key);
  if (!object) throw new StageError("NOT_FOUND", "File not found.");
  return { fileName: asset.fileName, mimeType: asset.mimeType, object };
}

/** Delete a file (R2 object + row), staff with project access only. */
export async function deleteFile(ctx: AuthContext, assetId: string): Promise<void> {
  const db = getDb();
  const asset = await db.query.assets.findFirst({ where: eq(schema.assets.id, assetId) });
  if (!asset) throw new StageError("NOT_FOUND", "File not found.");
  if (!ctx.isStaff || !canAccessAsset(ctx, asset)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "delete_file", resource: `asset:${assetId}`, reason: "not_permitted" });
    throw new StageError("FORBIDDEN", "You can't delete this file.");
  }

  await r2().delete(asset.r2Key);
  await db.batch([
    db.delete(schema.assets).where(eq(schema.assets.id, assetId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: asset.organizationId,
        actorUserId: ctx.user.id,
        action: "file.deleted",
        entityType: "asset",
        entityId: assetId,
        metadata: { fileName: asset.fileName },
      }),
    ),
  ]);
}
