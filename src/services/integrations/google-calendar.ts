/**
 * Google Calendar (per-user OAuth connect) — the calendar half of the Zoom round:
 * each staff member connects their own Google account (offline access → refresh
 * token in user_integrations), the portal shows their upcoming meetings with Join
 * buttons, and portal-scheduled Zoom calls land on their calendar with the deal
 * contact invited. Reuses the same arctic Google client (and OAuth app) as SSO.
 */
import { and, eq } from "drizzle-orm";
import { Google, generateState, generateCodeVerifier, decodeIdToken } from "arctic";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { googleClientId, googleClientSecret } from "@/auth/server-env";
import { assertStaff } from "@/services/sales";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

function client(redirectUri: string): Google {
  return new Google(googleClientId(), googleClientSecret(), redirectUri);
}

/** Begin the connect flow — like SSO start, plus offline access for a refresh token. */
export function startConnect(redirectUri: string): { url: URL; state: string; codeVerifier: string } {
  const g = client(redirectUri);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = g.createAuthorizationURL(state, codeVerifier, SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // force a refresh token even on re-connect
  return { url, state, codeVerifier };
}

/** Finish the connect flow: exchange the code, upsert the integration row. */
export async function completeConnect(
  ctx: AuthContext,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<void> {
  assertStaff(ctx, "connect_google_calendar");
  const g = client(redirectUri);
  const tokens = await g.validateAuthorizationCode(code, codeVerifier);
  const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
  if (!refreshToken) throw new StageError("VALIDATION", "Google didn't return a refresh token — try again.");
  const claims = decodeIdToken(tokens.idToken()) as { email?: string };

  const db = getDb();
  const existing = await db.query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, ctx.user.id), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  const row = {
    email: claims.email?.toLowerCase() ?? null,
    refreshToken,
    accessToken: tokens.accessToken(),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt(),
    disconnectedAt: null, // reconnect cancels any pending disconnect
  };
  if (existing) await db.update(schema.userIntegrations).set(row).where(eq(schema.userIntegrations.id, existing.id));
  else await db.insert(schema.userIntegrations).values({ userId: ctx.user.id, provider: "google_calendar", ...row });
}

/**
 * SOFT disconnect (frame 48): mark the row, keep the refresh token so the 30s
 * Undo can restore without re-auth. The token is actually revoked at Google only
 * when the disconnect is later confirmed (revokeIfLapsed) or on reconnect.
 */
export async function disconnect(ctx: AuthContext): Promise<void> {
  assertStaff(ctx, "disconnect_google_calendar");
  await getDb()
    .update(schema.userIntegrations)
    .set({ disconnectedAt: new Date() })
    .where(and(eq(schema.userIntegrations.userId, ctx.user.id), eq(schema.userIntegrations.provider, "google_calendar")));
}

/** Undo within the frame-48 window — restores sync with the stored token. */
export async function undoDisconnect(ctx: AuthContext): Promise<boolean> {
  assertStaff(ctx, "undo_disconnect_google_calendar");
  const db = getDb();
  const row = await db.query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, ctx.user.id), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  if (!row?.disconnectedAt) return false;
  await db.update(schema.userIntegrations).set({ disconnectedAt: null }).where(eq(schema.userIntegrations.id, row.id));
  return true;
}

/** After the undo window: revoke the token at Google and delete the row. */
export async function revokeIfLapsed(ctx: AuthContext): Promise<void> {
  assertStaff(ctx, "revoke_google_calendar");
  const db = getDb();
  const row = await db.query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, ctx.user.id), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  if (!row?.disconnectedAt) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refreshToken)}`, { method: "POST" });
  } catch (err) {
    console.error("[gcal] revoke failed (token still deleted):", err);
  }
  await db.delete(schema.userIntegrations).where(eq(schema.userIntegrations.id, row.id));
}

export type CalendarConnectionInfo = {
  connected: boolean;
  email: string | null;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
  pendingDisconnect: boolean;
};

export async function calendarConnection(userId: string): Promise<CalendarConnectionInfo> {
  const row = await getDb().query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, userId), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  return {
    connected: !!row && !row.disconnectedAt,
    email: row?.email ?? null,
    connectedAt: row?.createdAt ?? null,
    lastSyncAt: row?.lastSyncAt ?? null,
    pendingDisconnect: !!row?.disconnectedAt,
  };
}

export async function markSynced(userId: string): Promise<void> {
  await getDb()
    .update(schema.userIntegrations)
    .set({ lastSyncAt: new Date() })
    .where(and(eq(schema.userIntegrations.userId, userId), eq(schema.userIntegrations.provider, "google_calendar")));
}

/** A valid access token for the user (refreshes + caches when expired), or null. */
async function accessTokenFor(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db.query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, userId), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  if (!row || row.disconnectedAt) return null;
  const fresh = row.accessToken && row.accessTokenExpiresAt && row.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (fresh) return row.accessToken;
  // The redirect URI doesn't matter for refresh; any client instance works.
  const g = client("https://unused.invalid/callback");
  try {
    const tokens = await g.refreshAccessToken(row.refreshToken);
    const accessToken = tokens.accessToken();
    await db
      .update(schema.userIntegrations)
      .set({ accessToken, accessTokenExpiresAt: tokens.accessTokenExpiresAt() })
      .where(eq(schema.userIntegrations.id, row.id));
    return accessToken;
  } catch (err) {
    console.error("[gcal] token refresh failed:", err);
    return null;
  }
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  /** Zoom / Meet link sniffed from conference data, location, or description. */
  joinUrl: string | null;
  attendees: string[];
};

const MEETING_URL = /(https:\/\/[^\s"<>]*(?:zoom\.us\/j\/|meet\.google\.com\/)[^\s"<>]*)/;

type GcalEvent = {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  attendees?: { email?: string }[];
};

function sniffJoinUrl(e: GcalEvent): string | null {
  const video = e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri;
  if (video) return video;
  if (e.hangoutLink) return e.hangoutLink;
  for (const text of [e.location ?? "", e.description ?? ""]) {
    const m = MEETING_URL.exec(text);
    if (m) return m[1];
  }
  return null;
}

/** The user's next N events — the StaffHome Meetings card. Null = not connected. */
export async function listUpcomingEvents(ctx: AuthContext, maxN = 5): Promise<CalendarEvent[] | null> {
  assertStaff(ctx, "list_calendar");
  const token = await accessTokenFor(ctx.user.id);
  if (!token) return null;
  const url = new URL(`${CAL_BASE}/calendars/primary/events`);
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(maxN));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error("[gcal] events fetch failed:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = (await res.json()) as { items?: GcalEvent[] };
  return (data.items ?? [])
    .filter((e) => e.start?.dateTime || e.start?.date)
    .map((e) => ({
      id: e.id ?? crypto.randomUUID(),
      title: e.summary ?? "(no title)",
      start: new Date((e.start?.dateTime ?? e.start?.date) as string),
      end: e.end?.dateTime || e.end?.date ? new Date((e.end?.dateTime ?? e.end?.date) as string) : null,
      allDay: !e.start?.dateTime,
      joinUrl: sniffJoinUrl(e),
      attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    }));
}

/** Create a calendar event; returns the Google event id (linkage key), or null. */
export async function createEventFor(
  userId: string,
  input: {
    title: string;
    startsAt: Date;
    durationMin: number;
    description: string;
    location: string;
    attendees: string[];
    sendInvites: boolean;
  },
): Promise<{ eventId: string; calendarId: string } | null> {
  const token = await accessTokenFor(userId);
  if (!token) return null;
  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const res = await fetch(`${CAL_BASE}/calendars/primary/events?sendUpdates=${input.sendInvites ? "all" : "none"}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startsAt.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: input.attendees.map((email) => ({ email })),
    }),
  });
  if (!res.ok) {
    console.error("[gcal] event create failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { id?: string };
  return data.id ? { eventId: data.id, calendarId: "primary" } : null;
}

/** Patch an existing event's time (frame 42 Reschedule — updates, never recreates). */
export async function rescheduleEventFor(
  userId: string,
  eventId: string,
  startsAt: Date,
  durationMin: number,
): Promise<boolean> {
  const token = await accessTokenFor(userId);
  if (!token) return false;
  const end = new Date(startsAt.getTime() + durationMin * 60_000);
  const res = await fetch(`${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ start: { dateTime: startsAt.toISOString() }, end: { dateTime: end.toISOString() } }),
  });
  if (!res.ok) console.error("[gcal] reschedule failed:", res.status, await res.text().catch(() => ""));
  return res.ok;
}

// ---------------------------------------------------------------- sync feed + free/busy (frames 44/45)

export type SyncEvent = {
  googleEventId: string;
  recurringEventId: string | null;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  joinUrl: string | null;
  attendees: { email: string; name: string | null; response: string | null }[];
};

/** Raw upcoming events for the SYNC pipeline (richer than the display list). */
export async function listEventsForSync(userId: string, days = 30): Promise<SyncEvent[] | null> {
  const token = await accessTokenFor(userId);
  if (!token) return null;
  const url = new URL(`${CAL_BASE}/calendars/primary/events`);
  url.searchParams.set("timeMin", new Date(Date.now() - 24 * 3_600_000).toISOString()); // catch just-ended
  url.searchParams.set("timeMax", new Date(Date.now() + days * 86_400_000).toISOString());
  url.searchParams.set("maxResults", "100");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error("[gcal] sync fetch failed:", res.status, await res.text().catch(() => ""));
    return [];
  }
  type SyncGcalEvent = Omit<GcalEvent, "attendees"> & {
    recurringEventId?: string;
    attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
  };
  const data = (await res.json()) as { items?: SyncGcalEvent[] };
  return (data.items ?? [])
    .filter((e) => e.id && (e.start?.dateTime || e.start?.date))
    .map((e) => ({
      googleEventId: e.id as string,
      recurringEventId: e.recurringEventId ?? null,
      title: e.summary ?? "(no title)",
      start: new Date((e.start?.dateTime ?? e.start?.date) as string),
      end: e.end?.dateTime || e.end?.date ? new Date((e.end?.dateTime ?? e.end?.date) as string) : null,
      allDay: !e.start?.dateTime,
      joinUrl: sniffJoinUrl(e as GcalEvent),
      attendees: (e.attendees ?? [])
        .filter((a) => a.email)
        .map((a) => ({ email: (a.email as string).toLowerCase(), name: a.displayName ?? null, response: a.responseStatus ?? null })),
    }));
}

/** The member's calendar timezone (for working-hours slot suggestions). */
async function calendarTimeZone(userId: string): Promise<string> {
  const token = await accessTokenFor(userId);
  if (!token) return "UTC";
  const res = await fetch(`${CAL_BASE}/calendars/primary`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return "UTC";
  const data = (await res.json()) as { timeZone?: string };
  return data.timeZone ?? "UTC";
}

export type SuggestedSlot = { startsAt: string; label: string };

/**
 * Three suggested slots from the member's free/busy — working hours (9–17 in
 * their calendar TZ), weekdays, next 5 business days, honoring busy blocks.
 */
export async function suggestSlots(userId: string, durationMin = 45): Promise<SuggestedSlot[]> {
  const token = await accessTokenFor(userId);
  if (!token) return [];
  const tz = await calendarTimeZone(userId);
  const timeMin = new Date();
  const timeMax = new Date(Date.now() + 8 * 86_400_000);
  const res = await fetch(`${CAL_BASE}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: "primary" }] }),
  });
  const busy: { start: Date; end: Date }[] = [];
  if (res.ok) {
    const data = (await res.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
    for (const b of data.calendars?.primary?.busy ?? []) busy.push({ start: new Date(b.start), end: new Date(b.end) });
  }

  // Walk 30-min grid points in the member's local working hours; take 3 free ones
  // on distinct days when possible.
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit", day: "numeric", month: "short", hour12: true, hourCycle: "h12" });
  const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false, weekday: "short" });
  const slots: SuggestedSlot[] = [];
  const seenDays = new Set<string>();
  const startPoint = Math.ceil((Date.now() + 3 * 3_600_000) / (30 * 60_000)) * 30 * 60_000; // ≥3h out, on the half hour
  for (let t = startPoint; t < timeMax.getTime() && slots.length < 3; t += 30 * 60_000) {
    const s = new Date(t);
    const e = new Date(t + durationMin * 60_000);
    const parts = hourFmt.formatToParts(s);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    if (weekday === "Sat" || weekday === "Sun") continue;
    if (hour < 9 || hour + durationMin / 60 > 17) continue;
    if (busy.some((b) => s < b.end && e > b.start)) continue;
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" }).format(s);
    if (seenDays.has(dayKey) && slots.length < 2) continue; // spread across days for the first two
    seenDays.add(dayKey);
    slots.push({ startsAt: s.toISOString(), label: fmt.format(s) });
  }
  return slots;
}
