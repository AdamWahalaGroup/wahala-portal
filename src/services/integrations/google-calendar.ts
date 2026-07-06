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
  };
  if (existing) await db.update(schema.userIntegrations).set(row).where(eq(schema.userIntegrations.id, existing.id));
  else await db.insert(schema.userIntegrations).values({ userId: ctx.user.id, provider: "google_calendar", ...row });
}

export async function disconnect(ctx: AuthContext): Promise<void> {
  assertStaff(ctx, "disconnect_google_calendar");
  await getDb()
    .delete(schema.userIntegrations)
    .where(and(eq(schema.userIntegrations.userId, ctx.user.id), eq(schema.userIntegrations.provider, "google_calendar")));
}

export async function calendarConnection(userId: string): Promise<{ connected: boolean; email: string | null }> {
  const row = await getDb().query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, userId), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  return { connected: !!row, email: row?.email ?? null };
}

/** A valid access token for the user (refreshes + caches when expired), or null. */
async function accessTokenFor(userId: string): Promise<string | null> {
  const db = getDb();
  const row = await db.query.userIntegrations.findFirst({
    where: and(eq(schema.userIntegrations.userId, userId), eq(schema.userIntegrations.provider, "google_calendar")),
  });
  if (!row) return null;
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

/** Put a portal-scheduled Zoom call on the organizer's calendar (invites attendees). */
export async function createEventFor(
  userId: string,
  input: { title: string; startsAt: Date; durationMin: number; description: string; location: string; attendees: string[] },
): Promise<boolean> {
  const token = await accessTokenFor(userId);
  if (!token) return false;
  const end = new Date(input.startsAt.getTime() + input.durationMin * 60_000);
  const res = await fetch(`${CAL_BASE}/calendars/primary/events?sendUpdates=all`, {
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
  if (!res.ok) console.error("[gcal] event create failed:", res.status, await res.text().catch(() => ""));
  return res.ok;
}
