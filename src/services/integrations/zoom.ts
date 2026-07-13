/**
 * Zoom adapter (frames 43/47) — an OPTIONAL layer on the Google-event spine:
 * when connected, Schedule-call auto-attaches a Zoom link and cloud-recording
 * transcripts flow back through the webhook into the Deal's evidence-review pipeline.
 * Credentials come from app_settings (`zoom:credentials`, the frame-47 Connect
 * Zoom form) with env-var fallback — connecting is a settings save, not a deploy.
 * The pure helpers (VTT parsing, webhook signature) are exported for unit tests;
 * the webhook handler takes its downloader injected so it's testable without Zoom.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { ingestCallCore } from "@/services/process";
import { zoomAccountId, zoomClientId, zoomClientSecret, zoomSecretToken, zoomHostEmail } from "@/auth/server-env";

const ZOOM_API = "https://api.zoom.us/v2";
const TOKEN_KEY = "zoom:token";
const CREDS_KEY = "zoom:credentials";

export type ZoomCredentials = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  secretToken: string;
  hostEmail?: string;
};

/** app_settings first (frame-47 Connect form), env fallback. Null = not connected. */
export async function zoomCredentials(): Promise<ZoomCredentials | null> {
  const row = await getDb().query.appSettings.findFirst({ where: eq(schema.appSettings.key, CREDS_KEY) });
  const stored = (row?.value ?? null) as Partial<ZoomCredentials> | null;
  if (stored?.accountId && stored.clientId && stored.clientSecret) {
    return {
      accountId: stored.accountId,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      secretToken: stored.secretToken ?? "",
      hostEmail: stored.hostEmail,
    };
  }
  if (zoomAccountId() && zoomClientId() && zoomClientSecret()) {
    return {
      accountId: zoomAccountId(),
      clientId: zoomClientId(),
      clientSecret: zoomClientSecret(),
      secretToken: zoomSecretToken(),
      hostEmail: zoomHostEmail() || undefined,
    };
  }
  return null;
}

export async function zoomConfigured(): Promise<boolean> {
  return (await zoomCredentials()) !== null;
}

/** Save the frame-47 Connect Zoom form (admin). Clears the token cache. */
export async function saveZoomCredentials(ctx: AuthContext, creds: ZoomCredentials): Promise<void> {
  if (!ctx.isAdmin) throw new StageError("FORBIDDEN", "Only a Wahala admin can connect Zoom.");
  if (!creds.accountId?.trim() || !creds.clientId?.trim() || !creds.clientSecret?.trim()) {
    throw new StageError("VALIDATION", "Account ID, Client ID, and Client Secret are all required.");
  }
  const db = getDb();
  const value: ZoomCredentials = {
    accountId: creds.accountId.trim(),
    clientId: creds.clientId.trim(),
    clientSecret: creds.clientSecret.trim(),
    secretToken: creds.secretToken?.trim() ?? "",
    hostEmail: creds.hostEmail?.trim() || undefined,
  };
  const existing = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, CREDS_KEY) });
  if (existing) await db.update(schema.appSettings).set({ value, updatedByUserId: ctx.user.id }).where(eq(schema.appSettings.key, CREDS_KEY));
  else await db.insert(schema.appSettings).values({ key: CREDS_KEY, value, updatedByUserId: ctx.user.id });
  const token = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, TOKEN_KEY) });
  if (token) await db.update(schema.appSettings).set({ value: {} }).where(eq(schema.appSettings.key, TOKEN_KEY));
}

/** The webhook secret token (app_settings creds first, env fallback). */
export async function webhookSecret(): Promise<string> {
  const creds = await zoomCredentials();
  return creds?.secretToken || zoomSecretToken();
}

// ---------------------------------------------------------------- S2S token (cached in app_settings)

async function zoomToken(): Promise<string> {
  const creds = await zoomCredentials();
  if (!creds) throw new StageError("INVALID_STATE", "Zoom isn't connected — add the Server-to-Server app in Settings → Integrations.");
  const db = getDb();
  const row = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, TOKEN_KEY) });
  const cached = (row?.value ?? null) as { token?: string; expiresAt?: number } | null;
  if (cached?.token && cached.expiresAt && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`, {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}` },
  });
  if (!res.ok) {
    console.error("[zoom] token failed:", res.status, await res.text().catch(() => ""));
    throw new StageError("INVALID_STATE", "Zoom auth failed — check the Server-to-Server credentials.");
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const value = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 120) * 1000 };
  if (row) await db.update(schema.appSettings).set({ value }).where(eq(schema.appSettings.key, TOKEN_KEY));
  else await db.insert(schema.appSettings).values({ key: TOKEN_KEY, value });
  return data.access_token;
}

// ---------------------------------------------------------------- create meeting

/** Create a scheduled Zoom meeting (cloud recording ON — disclosure stays on). */
export async function createZoomMeeting(input: {
  hostEmail: string;
  topic: string;
  startsAt: Date;
  durationMin: number;
}): Promise<{ id: string; joinUrl: string; startUrl: string | null }> {
  const creds = await zoomCredentials();
  const token = await zoomToken();
  const hostCandidates = [input.hostEmail, creds?.hostEmail, "me"].filter(Boolean) as string[];
  let lastErr = "";
  for (const host of hostCandidates) {
    const res = await fetch(`${ZOOM_API}/users/${encodeURIComponent(host)}/meetings`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        topic: input.topic,
        type: 2, // scheduled
        start_time: input.startsAt.toISOString(),
        duration: input.durationMin,
        timezone: "UTC",
        settings: {
          auto_recording: "cloud", // transcript source; recording disclosure stays ON
          join_before_host: true,
          waiting_room: false,
        },
      }),
    });
    if (res.ok) {
      const created = (await res.json()) as { id: number | string; join_url: string; start_url?: string };
      return { id: String(created.id), joinUrl: created.join_url, startUrl: created.start_url ?? null };
    }
    lastErr = `${res.status} ${await res.text().catch(() => "")}`;
    if (res.status !== 404) break; // 404 = host not a Zoom user → try the next candidate
  }
  console.error("[zoom] meeting create failed:", lastErr);
  throw new StageError("INVALID_STATE", "Zoom couldn't create the meeting — check the host account.");
}

// ---------------------------------------------------------------- webhook (pure helpers exported for tests)

/** Zoom webhook signature: x-zm-signature = "v0=" + HMAC_SHA256(secret, "v0:{ts}:{body}"). */
export async function verifyZoomSignature(
  signature: string | null,
  timestamp: string | null,
  body: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !timestamp || !secret) return false;
  const mac = await hmacHex(secret, `v0:${timestamp}:${body}`);
  return signature === `v0=${mac}`;
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * WebVTT → "Speaker: text" transcript. Strips cue numbers/timestamps, merges
 * consecutive cues from the same speaker (Zoom emits "Name: text" cue lines).
 */
export function vttToTranscript(vtt: string): string {
  const lines = vtt.replace(/\r/g, "").split("\n");
  const out: { speaker: string | null; text: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === "WEBVTT" || /^\d+$/.test(line) || line.includes("-->") || line.startsWith("NOTE")) continue;
    const m = /^([^:]{1,60}):\s*(.*)$/.exec(line);
    const speaker = m ? m[1].trim() : null;
    const text = m ? m[2].trim() : line;
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === speaker) last.text += ` ${text}`;
    else out.push({ speaker, text });
  }
  return out.map((c) => (c.speaker ? `${c.speaker}: ${c.text}` : c.text)).join("\n");
}

export type TranscriptCompletedPayload = {
  object?: {
    id?: number | string;
    uuid?: string;
    topic?: string;
    start_time?: string;
    duration?: number;
    recording_files?: { file_type?: string; download_url?: string }[];
  };
};

/**
 * Handle recording.transcript_completed. Matching order: the meetings row keyed
 * by zoomMeetingId (covers portal-scheduled AND synced calendar events whose
 * join link carried the meeting id). A linked row ingests straight onto its deal
 * (→ digest_ready, the legacy internal name for analysis ready); a known-but-unlinked
 * row holds the transcript for the inbox;
 * an unknown meeting becomes a fresh inbox row.
 */
export async function handleTranscriptCompleted(
  payload: TranscriptCompletedPayload,
  download: (url: string) => Promise<string | null>,
): Promise<{ outcome: "ingested" | "held" | "unmatched" | "skipped" }> {
  const obj = payload.object ?? {};
  const zoomMeetingId = obj.id !== undefined ? String(obj.id) : null;
  const vttUrl = (obj.recording_files ?? []).find((f) => f.file_type === "TRANSCRIPT")?.download_url ?? null;
  if (!zoomMeetingId || !vttUrl) return { outcome: "skipped" };
  const vtt = await download(vttUrl);
  if (!vtt) return { outcome: "skipped" };
  const transcript = vttToTranscript(vtt);
  if (!transcript.trim()) return { outcome: "skipped" };

  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.zoomMeetingId, zoomMeetingId) });
  const recordedAt = obj.start_time ? new Date(obj.start_time) : new Date();
  const durationMin = obj.duration ?? null;

  if (meeting?.dealId) {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, meeting.dealId) });
    if (deal) {
      const { callId } = await ingestCallCore(
        deal,
        { title: meeting.title, transcriptMd: transcript, recordedAt, durationMin },
        meeting.createdByUserId ?? meeting.syncedByUserId,
        "webhook",
      );
      await db.update(schema.meetings).set({ status: "digest_ready", callId, transcriptMd: null }).where(eq(schema.meetings.id, meeting.id));
      return { outcome: "ingested" };
    }
  }

  if (meeting) {
    // Known meeting, no deal yet — hold the transcript; linking graduates it.
    await db.update(schema.meetings).set({ status: "ended", transcriptMd: transcript }).where(eq(schema.meetings.id, meeting.id));
    return { outcome: "held" };
  }

  await db.insert(schema.meetings).values({
    zoomMeetingId,
    title: obj.topic?.trim() || "Zoom call",
    startsAt: recordedAt,
    endsAt: durationMin ? new Date(recordedAt.getTime() + durationMin * 60_000) : null,
    status: "ended",
    transcriptMd: transcript,
    source: "google",
  });
  return { outcome: "unmatched" };
}

/** meeting.ended bookkeeping (webhook) — zoom meetings go to awaiting_recording. */
export async function markMeetingEnded(zoomMeetingId: string): Promise<void> {
  try {
    const db = getDb();
    const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.zoomMeetingId, zoomMeetingId) });
    if (!meeting || meeting.status !== "upcoming") return;
    await db
      .update(schema.meetings)
      .set({ status: meeting.videoProvider === "zoom" ? "awaiting_recording" : "ended" })
      .where(eq(schema.meetings.id, meeting.id));
  } catch (err) {
    console.error("[zoom] meeting.ended update failed:", err);
  }
}

/** Download a recording file using the webhook's short-lived download token. */
export function webhookDownloader(downloadToken: string | undefined): (url: string) => Promise<string | null> {
  return async (url: string) => {
    const sep = url.includes("?") ? "&" : "?";
    const full = downloadToken ? `${url}${sep}access_token=${encodeURIComponent(downloadToken)}` : url;
    const res = await fetch(full, { headers: downloadToken ? { authorization: `Bearer ${downloadToken}` } : undefined });
    if (!res.ok) {
      console.error("[zoom] transcript download failed:", res.status);
      return null;
    }
    return await res.text();
  };
}
