/**
 * Zoom (Server-to-Server OAuth) — the meeting half of the capture loop:
 * portal-scheduled Zoom calls (cloud recording ON, disclosure ON — Florida is
 * all-party consent) and the webhook that delivers the finished transcript back
 * onto the deal. Real-time is deliberately out of scope ("posts, not real time,
 * good enough" — Jason). The pure helpers (VTT parsing, webhook signature) are
 * exported for unit tests; the webhook handler takes its downloader/ingester as
 * parameters so it's testable without Zoom.
 */
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager } from "@/services/sales";
import { ingestCallCore } from "@/services/process";
import { createEventFor, calendarConnection } from "@/services/integrations/google-calendar";
import { zoomAccountId, zoomClientId, zoomClientSecret, zoomHostEmail } from "@/auth/server-env";

const ZOOM_API = "https://api.zoom.us/v2";
const TOKEN_KEY = "zoom:token";

export function zoomConfigured(): boolean {
  return !!(zoomAccountId() && zoomClientId() && zoomClientSecret());
}

// ---------------------------------------------------------------- S2S token (cached in app_settings)

async function zoomToken(): Promise<string> {
  if (!zoomConfigured()) throw new StageError("INVALID_STATE", "Zoom isn't set up yet — add the Server-to-Server app credentials.");
  const db = getDb();
  const row = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, TOKEN_KEY) });
  const cached = (row?.value ?? null) as { token?: string; expiresAt?: number } | null;
  if (cached?.token && cached.expiresAt && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(zoomAccountId())}`, {
    method: "POST",
    headers: { authorization: `Basic ${btoa(`${zoomClientId()}:${zoomClientSecret()}`)}` },
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

// ---------------------------------------------------------------- schedule (frame-less v1 UI)

export type ScheduledMeeting = {
  meetingId: string;
  zoomMeetingId: string;
  joinUrl: string;
  startUrl: string | null;
  calendarAdded: boolean;
};

/**
 * Schedule a Zoom call FROM a deal: Zoom meeting (auto cloud recording → the
 * transcript webhook), a meetings row bound to the deal (deterministic attach),
 * and — when the scheduler has Google connected — a calendar event that invites
 * the deal contact. Sales manager.
 */
export async function scheduleDealMeeting(
  ctx: AuthContext,
  dealId: string,
  input: { topic?: string; startsAt: string; durationMin?: number; inviteContact?: boolean },
): Promise<ScheduledMeeting> {
  assertSalesManager(ctx, "schedule_meeting");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new StageError("VALIDATION", "Pick a valid start time.");
  const durationMin = Math.max(15, Math.min(480, Math.round(input.durationMin ?? 45)));
  const topic = input.topic?.trim() || deal.name;

  const token = await zoomToken();
  // Host = the scheduler when their email is a Zoom user; ZOOM_HOST_EMAIL fallback; else the app account.
  const hostCandidates = [ctx.user.email, zoomHostEmail(), "me"].filter(Boolean) as string[];
  let created: { id: number | string; join_url: string; start_url?: string } | null = null;
  let lastErr = "";
  for (const host of hostCandidates) {
    const res = await fetch(`${ZOOM_API}/users/${encodeURIComponent(host)}/meetings`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        topic,
        type: 2, // scheduled
        start_time: startsAt.toISOString(),
        duration: durationMin,
        timezone: "UTC",
        settings: {
          auto_recording: "cloud", // transcript source; recording disclosure stays ON
          join_before_host: true,
          waiting_room: false,
        },
      }),
    });
    if (res.ok) {
      created = (await res.json()) as { id: number | string; join_url: string; start_url?: string };
      break;
    }
    lastErr = `${res.status} ${await res.text().catch(() => "")}`;
    if (res.status !== 404) break; // 404 = host not a Zoom user → try the next candidate
  }
  if (!created) {
    console.error("[zoom] meeting create failed:", lastErr);
    throw new StageError("INVALID_STATE", "Zoom couldn't create the meeting — check the host account.");
  }

  const meetingId = crypto.randomUUID();
  await db.insert(schema.meetings).values({
    id: meetingId,
    zoomMeetingId: String(created.id),
    organizationId: deal.organizationId,
    dealId,
    topic,
    joinUrl: created.join_url,
    startUrl: created.start_url ?? null,
    scheduledByUserId: ctx.user.id,
    startsAt,
    durationMin,
    status: "scheduled",
  });

  // Best-effort calendar event (never blocks the schedule).
  let calendarAdded = false;
  const { connected } = await calendarConnection(ctx.user.id);
  if (connected) {
    const attendees: string[] = [];
    if (input.inviteContact && deal.primaryContactId) {
      const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, deal.primaryContactId) });
      if (contact?.email) attendees.push(contact.email);
    }
    calendarAdded = await createEventFor(ctx.user.id, {
      title: topic,
      startsAt,
      durationMin,
      description: `Zoom: ${created.join_url}\n\nScheduled from Wahala Portal — the transcript lands on the deal automatically after the call.`,
      location: created.join_url,
      attendees,
    });
  }

  return { meetingId, zoomMeetingId: String(created.id), joinUrl: created.join_url, startUrl: created.start_url ?? null, calendarAdded };
}

/** Upcoming + recent meetings for one deal (the Recorded-calls card list). */
export async function meetingsForDeal(ctx: AuthContext, dealId: string) {
  const db = getDb();
  const rows = await db.select().from(schema.meetings).where(eq(schema.meetings.dealId, dealId));
  return rows
    .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0))
    .map((m) => ({ id: m.id, topic: m.topic, startsAt: m.startsAt, joinUrl: m.joinUrl, status: m.status }));
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
 * Handle recording.transcript_completed. The downloader is injected (webhook
 * download_token vs S2S token, and unit tests). Matched meetings ingest straight
 * onto their deal; unknown meetings are held as an unmatched inbox row.
 */
export async function handleTranscriptCompleted(
  payload: TranscriptCompletedPayload,
  download: (url: string) => Promise<string | null>,
): Promise<{ outcome: "ingested" | "unmatched" | "skipped" }> {
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
  const durationMin = obj.duration ?? meeting?.durationMin ?? null;

  if (meeting?.dealId) {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, meeting.dealId) });
    if (deal) {
      const { callId } = await ingestCallCore(
        deal,
        { title: meeting.topic, transcriptMd: transcript, recordedAt, durationMin },
        meeting.scheduledByUserId,
      );
      await db.update(schema.meetings).set({ status: "transcribed", callId, transcriptMd: null }).where(eq(schema.meetings.id, meeting.id));
      return { outcome: "ingested" };
    }
  }

  // Unknown or unattached meeting → hold the transcript for the manual-attach inbox.
  if (meeting) {
    await db.update(schema.meetings).set({ status: "unmatched", transcriptMd: transcript }).where(eq(schema.meetings.id, meeting.id));
  } else {
    await db.insert(schema.meetings).values({
      zoomMeetingId,
      topic: obj.topic?.trim() || "Zoom call",
      startsAt: recordedAt,
      durationMin,
      status: "unmatched",
      transcriptMd: transcript,
    });
  }
  return { outcome: "unmatched" };
}

/** meeting.ended bookkeeping (webhook) — silent no-op for unknown meetings. */
export async function markMeetingEnded(zoomMeetingId: string): Promise<void> {
  try {
    await getDb().update(schema.meetings).set({ status: "ended" }).where(eq(schema.meetings.zoomMeetingId, zoomMeetingId));
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

// ---------------------------------------------------------------- unmatched inbox

export type UnmatchedMeeting = { id: string; topic: string; startsAt: Date | null; durationMin: number | null };

export async function listUnmatchedMeetings(ctx: AuthContext): Promise<UnmatchedMeeting[]> {
  if (!ctx.isStaff) return [];
  const rows = await getDb().select().from(schema.meetings).where(eq(schema.meetings.status, "unmatched"));
  return rows
    .sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0))
    .map((m) => ({ id: m.id, topic: m.topic, startsAt: m.startsAt, durationMin: m.durationMin }));
}

/** Attach an unmatched transcript to a deal — it graduates into deal_calls + extractor. */
export async function attachMeetingToDeal(ctx: AuthContext, meetingId: string, dealId: string): Promise<{ callId: string; readiness: number }> {
  assertSalesManager(ctx, "attach_meeting");
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, meetingId) });
  if (!meeting || meeting.status !== "unmatched" || !meeting.transcriptMd) throw new StageError("NOT_FOUND", "Unmatched transcript not found.");
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");

  const { callId, readiness } = await ingestCallCore(
    deal,
    { title: meeting.topic, transcriptMd: meeting.transcriptMd, recordedAt: meeting.startsAt ?? new Date(), durationMin: meeting.durationMin },
    ctx.user.id,
  );
  await db
    .update(schema.meetings)
    .set({ status: "transcribed", dealId, organizationId: deal.organizationId, callId, transcriptMd: null })
    .where(eq(schema.meetings.id, meetingId));
  return { callId, readiness };
}
