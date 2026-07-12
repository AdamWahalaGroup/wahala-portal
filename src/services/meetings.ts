/**
 * Meetings (frames 42–46) — the hub over the integration adapters.
 *
 * Principles from CALENDAR-AND-MEETINGS.md: no calendar page (meetings render on
 * the objects they belong to); Google is the source of truth for time + attendee
 * responses, the portal for linkage; sync pulls only events with ≥1 external
 * attendee; auto-match by attendee email (link) or domain (suggest); "Not client
 * work" suppresses and teaches the matcher. Zoom is an optional layer — the
 * no-Zoom degraded state is the launch reality.
 */
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { assertSalesManager, assertStaff } from "@/services/sales";
import { buildAudit } from "@/services/audit";
import { ingestCallCore } from "@/services/process";
import {
  listEventsForSync,
  calendarConnection,
  markSynced,
  createEventFor,
  rescheduleEventFor,
  type SyncEvent,
} from "@/services/integrations/google-calendar";
import { createZoomMeeting, zoomConfigured } from "@/services/integrations/zoom";
import { staffSsoDomains } from "@/auth/server-env";

const SYNC_STALE_MIN = 10;

// ---------------------------------------------------------------- helpers

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

/** Zoom meeting id from a join URL (zoom.us/j/123456789) — keys the transcript webhook. */
export function zoomIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const m = /zoom\.us\/[js]\/(\d{8,12})/.exec(url);
  return m ? m[1] : null;
}

type Attendee = { email: string; name: string | null; response: string | null };

// ---------------------------------------------------------------- sync + auto-match (frame 45)

/**
 * Pull the member's calendar into the meetings table. Skips all-day events,
 * events with no non-staff attendee, and suppressed events/series. New rows
 * auto-match: attendee email == a contact → LINK (account + sole open deal);
 * attendee domain == an account's contact-domain → SUGGEST; else plain inbox row.
 * Existing rows: time/attendees/video refresh from Google; linkage never changes.
 */
export async function syncUserCalendar(ctx: AuthContext): Promise<{ synced: number } | null> {
  assertStaff(ctx, "sync_calendar");
  const events = await listEventsForSync(ctx.user.id);
  if (events === null) return null; // not connected

  const db = getDb();
  const staffDomains = new Set([...staffSsoDomains(), "wahala.group"]);
  const [suppressions, contacts, orgs] = await Promise.all([
    db.select().from(schema.meetingSuppressions),
    db.select({ id: schema.contacts.id, email: schema.contacts.email, organizationId: schema.contacts.organizationId }).from(schema.contacts),
    db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations),
  ]);
  const suppressedEvents = new Set(suppressions.map((s) => s.googleEventId).filter(Boolean) as string[]);
  const suppressedSeries = new Set(suppressions.map((s) => s.recurringEventId).filter(Boolean) as string[]);
  const contactByEmail = new Map(contacts.filter((c) => c.email && c.organizationId).map((c) => [c.email!.toLowerCase(), c]));
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  // Account "domains" = the domains of its contacts' emails.
  const orgByDomain = new Map<string, string>();
  for (const c of contacts) {
    if (c.email && c.organizationId) orgByDomain.set(domainOf(c.email), c.organizationId);
  }

  let synced = 0;
  const now = new Date();
  for (const e of events) {
    if (e.allDay) continue;
    if (suppressedEvents.has(e.googleEventId) || (e.recurringEventId && suppressedSeries.has(e.recurringEventId))) continue;
    const external = e.attendees.filter((a) => !staffDomains.has(domainOf(a.email)));
    if (external.length === 0) continue; // internal meeting — personal calendars never sync in

    const existing = await db.query.meetings.findFirst({ where: eq(schema.meetings.googleEventId, e.googleEventId) });
    const ended = e.end ? e.end < now : e.start < now;
    if (existing) {
      // Google owns time + attendees + video; the portal owns linkage + status ramp.
      await db
        .update(schema.meetings)
        .set({
          title: e.title,
          startsAt: e.start,
          endsAt: e.end,
          attendees: e.attendees,
          videoUrl: existing.videoProvider === "manual" ? existing.videoUrl : (e.joinUrl ?? existing.videoUrl),
          zoomMeetingId: existing.zoomMeetingId ?? zoomIdFromUrl(e.joinUrl),
          status: existing.status === "upcoming" && ended ? "ended" : existing.status,
        })
        .where(eq(schema.meetings.id, existing.id));
      synced++;
      continue;
    }

    // New row → auto-match.
    let organizationId: string | null = null;
    let dealId: string | null = null;
    let suggestedOrganizationId: string | null = null;
    let suggestionReason: string | null = null;
    const exact = external.map((a) => contactByEmail.get(a.email)).find(Boolean);
    if (exact?.organizationId) {
      organizationId = exact.organizationId;
      const openDeals = await db
        .select({ id: schema.deals.id, stage: schema.deals.stage, primaryContactId: schema.deals.primaryContactId })
        .from(schema.deals)
        .where(eq(schema.deals.organizationId, exact.organizationId));
      const open = openDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
      const mine = open.filter((d) => d.primaryContactId === exact.id);
      if (mine.length === 1) dealId = mine[0].id;
      else if (open.length === 1) dealId = open[0].id;
    } else {
      const domainHit = external.map((a) => orgByDomain.get(domainOf(a.email))).find(Boolean);
      if (domainHit) {
        suggestedOrganizationId = domainHit;
        const who = external.find((a) => orgByDomain.get(domainOf(a.email)) === domainHit);
        suggestionReason = `${who?.email} — looks like ${orgName.get(domainHit) ?? "a known account"} (domain match)`;
      }
    }

    await db.insert(schema.meetings).values({
      googleEventId: e.googleEventId,
      googleCalendarId: "primary",
      zoomMeetingId: zoomIdFromUrl(e.joinUrl),
      organizationId,
      dealId,
      title: e.title,
      startsAt: e.start,
      endsAt: e.end,
      attendees: e.attendees,
      videoUrl: e.joinUrl,
      videoProvider: e.joinUrl ? (zoomIdFromUrl(e.joinUrl) ? "zoom" : "manual") : null,
      status: ended ? "ended" : "upcoming",
      suggestedOrganizationId,
      suggestionReason,
      syncedByUserId: ctx.user.id,
      source: "google",
    });
    synced++;
  }
  await markSynced(ctx.user.id);
  return { synced };
}

/** Lazy sync: refresh when older than SYNC_STALE_MIN — keeps "last sync" honest. */
export async function syncIfStale(ctx: AuthContext): Promise<void> {
  const conn = await calendarConnection(ctx.user.id);
  if (!conn.connected) return;
  if (conn.lastSyncAt && Date.now() - conn.lastSyncAt.getTime() < SYNC_STALE_MIN * 60_000) return;
  try {
    await syncUserCalendar(ctx);
  } catch (err) {
    console.error("[meetings] lazy sync failed:", err);
  }
}

// ---------------------------------------------------------------- views

export type MeetingView = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  videoUrl: string | null;
  videoProvider: "zoom" | "manual" | null;
  status: (typeof schema.MEETING_STATUSES)[number];
  attendees: Attendee[];
  dealId: string | null;
  organizationId: string | null;
  callId: string | null;
  createdByName: string | null;
  synced: boolean;
};

function toView(m: typeof schema.meetings.$inferSelect, names?: Map<string, string>): MeetingView {
  return {
    id: m.id,
    title: m.title,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    videoUrl: m.videoUrl,
    videoProvider: m.videoProvider,
    status: m.status,
    attendees: ((m.attendees ?? []) as Attendee[]) || [],
    dealId: m.dealId,
    organizationId: m.organizationId,
    callId: m.callId,
    createdByName: m.createdByUserId ? (names?.get(m.createdByUserId) ?? null) : null,
    synced: !!m.googleEventId,
  };
}

/** Meetings on one deal, newest-first; the next upcoming one is the deal's next step. */
export async function meetingsForDeal(ctx: AuthContext, dealId: string): Promise<MeetingView[]> {
  assertStaff(ctx, "meetings_for_deal");
  const db = getDb();
  const rows = await db.select().from(schema.meetings).where(eq(schema.meetings.dealId, dealId));
  const names = await userNames(rows.map((r) => r.createdByUserId));
  return rows.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()).map((r) => toView(r, names));
}

/** Frame 45 today strip: the member's matched meetings for the rest of today. */
export async function todayMeetings(ctx: AuthContext): Promise<(MeetingView & { dealName: string | null })[]> {
  assertStaff(ctx, "today_meetings");
  const db = getDb();
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(and(gte(schema.meetings.startsAt, new Date(Date.now() - 90 * 60_000)), eq(schema.meetings.status, "upcoming")));
  const today = rows.filter((r) => r.startsAt <= dayEnd && (r.organizationId || r.dealId));
  const dealIds = [...new Set(today.map((r) => r.dealId).filter(Boolean) as string[])];
  const deals = dealIds.length
    ? await db.select({ id: schema.deals.id, name: schema.deals.name }).from(schema.deals).where(inArray(schema.deals.id, dealIds))
    : [];
  const dealName = new Map(deals.map((d) => [d.id, d.name]));
  return today
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((r) => ({ ...toView(r), dealName: r.dealId ? (dealName.get(r.dealId) ?? null) : null }));
}

export type InboxRow = {
  id: string;
  title: string;
  startsAt: Date;
  reason: string | null;
  suggestedOrganizationId: string | null;
  suggestedOrgName: string | null;
  hasTranscript: boolean;
};

/** Frame 45 meeting inbox: synced events that didn't auto-match (org & deal both null). */
export async function meetingInbox(ctx: AuthContext): Promise<InboxRow[]> {
  assertStaff(ctx, "meeting_inbox");
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(and(isNull(schema.meetings.dealId), isNull(schema.meetings.organizationId)));
  const orgIds = [...new Set(rows.map((r) => r.suggestedOrganizationId).filter(Boolean) as string[])];
  const orgs = orgIds.length
    ? await getDb().select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))
    : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  return rows
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.startsAt,
      reason: r.suggestionReason,
      suggestedOrganizationId: r.suggestedOrganizationId,
      suggestedOrgName: r.suggestedOrganizationId ? (orgName.get(r.suggestedOrganizationId) ?? null) : null,
      hasTranscript: !!r.transcriptMd,
    }));
}

/** Frame 46: the client's next call with Wahala (their org's next upcoming meeting). */
export async function nextCallForClient(ctx: AuthContext): Promise<MeetingView | null> {
  if (ctx.isStaff || !ctx.user.organizationId) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(and(eq(schema.meetings.organizationId, ctx.user.organizationId), eq(schema.meetings.status, "upcoming")));
  const future = rows.filter((r) => r.startsAt.getTime() > Date.now() - 90 * 60_000);
  if (future.length === 0) return null;
  return toView(future.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]);
}

async function userNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (unique.length === 0) return new Map();
  const rows = await getDb().select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, unique));
  return new Map(rows.map((r) => [r.id, r.name]));
}

// ---------------------------------------------------------------- schedule / reschedule (frame 44)

/**
 * Schedule a call FROM the deal: a Google Calendar event on the scheduler's
 * calendar (requires their Google connect), an optional Zoom link (auto when the
 * company Zoom is connected, else the pasted link, else the loud "no video link"
 * state), and a meetings row bound to the deal — it becomes the deal's next step.
 */
export async function scheduleCall(
  ctx: AuthContext,
  dealId: string,
  input: {
    title?: string;
    startsAt: string;
    durationMin?: number;
    contactIds?: string[];
    sendInvite?: boolean;
    videoUrl?: string;
  },
): Promise<{ meetingId: string; videoUrl: string | null; calendarEventId: string }> {
  assertSalesManager(ctx, "schedule_call");
  const db = getDb();
  const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
  if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
  const scope = ctx.accessScope;
  if (scope.kind !== "all" && deal.organizationId !== null && !scope.orgIds.includes(deal.organizationId)) throw new StageError("NOT_FOUND", "Deal not found.");
  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new StageError("VALIDATION", "Pick a valid start time.");
  const durationMin = Math.max(15, Math.min(480, Math.round(input.durationMin ?? 45)));
  const org = deal.organizationId ? await db.query.organizations.findFirst({ where: eq(schema.organizations.id, deal.organizationId) }) : null;
  const title = input.title?.trim() || `${deal.name} — ${org?.name ?? "Client"} × Wahala`;

  // Attendees: the chosen account contacts (must have emails).
  const contactIds = input.contactIds ?? [];
  const attendeeContacts = contactIds.length
    ? await db.select().from(schema.contacts).where(inArray(schema.contacts.id, contactIds))
    : [];
  const attendeeEmails = attendeeContacts.map((c) => c.email).filter(Boolean) as string[];

  // Video: company Zoom when connected; else a pasted link; else none (loud state).
  let videoUrl = input.videoUrl?.trim() || null;
  let videoProvider: "zoom" | "manual" | null = videoUrl ? "manual" : null;
  let zoomMeetingId: string | null = null;
  let startUrl: string | null = null;
  if (await zoomConfigured()) {
    try {
      const zm = await createZoomMeeting({ hostEmail: ctx.user.email, topic: title, startsAt, durationMin });
      videoUrl = zm.joinUrl;
      videoProvider = "zoom";
      zoomMeetingId = zm.id;
      startUrl = zm.startUrl;
    } catch (err) {
      console.error("[meetings] zoom create failed — falling back to no-video:", err);
    }
  } else if (videoUrl) {
    zoomMeetingId = zoomIdFromUrl(videoUrl);
    if (zoomMeetingId) videoProvider = "zoom";
  }

  // The Google event is the spine — scheduling requires the member's calendar.
  const created = await createEventFor(ctx.user.id, {
    title,
    startsAt,
    durationMin,
    description: `${videoUrl ? `Join: ${videoUrl}\n\n` : ""}Scheduled from Wahala Portal — lives on the "${deal.name}" deal.`,
    location: videoUrl ?? "",
    attendees: attendeeEmails,
    sendInvites: input.sendInvite !== false,
  });
  if (!created) throw new StageError("INVALID_STATE", "Connect your Google Calendar first — the event is created on your calendar.");

  const meetingId = crypto.randomUUID();
  await db.batch([
    db.insert(schema.meetings).values({
      id: meetingId,
      googleEventId: created.eventId,
      googleCalendarId: created.calendarId,
      zoomMeetingId,
      organizationId: deal.organizationId,
      dealId,
      title,
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMin * 60_000),
      attendees: attendeeContacts.map((c) => ({ email: c.email ?? "", name: c.name, response: null })),
      videoUrl,
      videoProvider,
      startUrl,
      status: "upcoming",
      createdByUserId: ctx.user.id,
      syncedByUserId: ctx.user.id,
      source: "portal",
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: deal.organizationId,
        actorUserId: ctx.user.id,
        action: "deal.call_scheduled",
        entityType: "deal",
        entityId: dealId,
        metadata: {
          title,
          startsAt: startsAt.toISOString(),
          invited: attendeeEmails,
          note: `Event created in Google Calendar${attendeeEmails.length ? ` · invite to ${attendeeContacts.map((c) => c.name).join(", ")}` : ""}`,
        },
      }),
    ),
  ]);
  return { meetingId, videoUrl, calendarEventId: created.eventId };
}

/** Frame 42 Reschedule: patches the existing Google event, never recreates. */
export async function rescheduleMeeting(ctx: AuthContext, meetingId: string, startsAtIso: string, durationMin?: number): Promise<void> {
  assertSalesManager(ctx, "reschedule_call");
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, meetingId) });
  if (!meeting) throw new StageError("NOT_FOUND", "Meeting not found.");
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) throw new StageError("VALIDATION", "Pick a valid start time.");
  const mins = durationMin ?? (meeting.endsAt ? Math.round((meeting.endsAt.getTime() - meeting.startsAt.getTime()) / 60_000) : 45);
  if (meeting.googleEventId && meeting.syncedByUserId) {
    const ok = await rescheduleEventFor(meeting.syncedByUserId, meeting.googleEventId, startsAt, mins);
    if (!ok) throw new StageError("INVALID_STATE", "Google Calendar update failed — is the organizer's calendar still connected?");
  }
  await db
    .update(schema.meetings)
    .set({
      startsAt,
      endsAt: new Date(startsAt.getTime() + mins * 60_000),
      status: "upcoming",
      // Momentum signal: reschedules drag the deal's priority down.
      rescheduleCount: sql`${schema.meetings.rescheduleCount} + 1`,
    })
    .where(eq(schema.meetings.id, meetingId));
}

/** Paste-a-link on the no-video row (frames 42/43): provider 'manual'. */
export async function setMeetingVideoUrl(ctx: AuthContext, meetingId: string, videoUrl: string): Promise<void> {
  assertStaff(ctx, "set_meeting_video");
  const url = videoUrl.trim();
  if (!/^https:\/\//.test(url)) throw new StageError("VALIDATION", "Paste a full https:// meeting link.");
  const zoomId = zoomIdFromUrl(url);
  await getDb()
    .update(schema.meetings)
    .set({ videoUrl: url, videoProvider: zoomId ? "zoom" : "manual", zoomMeetingId: zoomId })
    .where(eq(schema.meetings.id, meetingId));
}

// ---------------------------------------------------------------- inbox actions (frame 45)

/** Link an inbox meeting to a deal (or just an account). Held transcripts graduate. */
export async function linkMeeting(
  ctx: AuthContext,
  meetingId: string,
  target: { dealId?: string; organizationId?: string },
): Promise<void> {
  assertSalesManager(ctx, "link_meeting");
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, meetingId) });
  if (!meeting) throw new StageError("NOT_FOUND", "Meeting not found.");

  let organizationId = target.organizationId ?? null;
  let dealId = target.dealId ?? null;
  if (dealId) {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
    if (!deal) throw new StageError("NOT_FOUND", "Deal not found.");
    organizationId = deal.organizationId;
  }
  if (!organizationId) throw new StageError("VALIDATION", "Pick a deal or an account to link to.");

  let callId = meeting.callId;
  let status = meeting.status;
  if (meeting.transcriptMd && dealId) {
    const deal = await db.query.deals.findFirst({ where: eq(schema.deals.id, dealId) });
    if (deal) {
      const res = await ingestCallCore(
        deal,
        { title: meeting.title, transcriptMd: meeting.transcriptMd, recordedAt: meeting.startsAt, durationMin: meeting.endsAt ? Math.round((meeting.endsAt.getTime() - meeting.startsAt.getTime()) / 60_000) : null },
        ctx.user.id,
      );
      callId = res.callId;
      status = "digest_ready";
    }
  }
  await db
    .update(schema.meetings)
    .set({ organizationId, dealId, suggestedOrganizationId: null, suggestionReason: null, callId, status, transcriptMd: callId ? null : meeting.transcriptMd })
    .where(eq(schema.meetings.id, meetingId));
}

/** "Not client work" — remove the row and remember the event/series (teaches the matcher). */
export async function suppressMeeting(ctx: AuthContext, meetingId: string): Promise<void> {
  assertStaff(ctx, "suppress_meeting");
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, meetingId) });
  if (!meeting) throw new StageError("NOT_FOUND", "Meeting not found.");
  await db.batch([
    db.insert(schema.meetingSuppressions).values({
      googleEventId: meeting.googleEventId,
      recurringEventId: null,
      createdByUserId: ctx.user.id,
    }),
    db.delete(schema.meetings).where(eq(schema.meetings.id, meetingId)),
  ]);
}

// ---------------------------------------------------------------- .ics (frame 46 — never a Google-only link)

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function makeIcs(input: { uid: string; title: string; start: Date; end: Date; description: string; url: string | null }): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wahala Portal//Meetings//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@portal.wahala-services.com`,
    `DTSTAMP:${icsDate(new Date(input.start))}`,
    `DTSTART:${icsDate(input.start)}`,
    `DTEND:${icsDate(input.end)}`,
    `SUMMARY:${icsEscape(input.title)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    ...(input.url ? [`LOCATION:${icsEscape(input.url)}`, `URL:${input.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** The .ics for one meeting — staff, or a client user of the meeting's org. */
export async function icsForMeeting(ctx: AuthContext, meetingId: string): Promise<{ fileName: string; ics: string }> {
  const db = getDb();
  const meeting = await db.query.meetings.findFirst({ where: eq(schema.meetings.id, meetingId) });
  if (!meeting) throw new StageError("NOT_FOUND", "Meeting not found.");
  const allowed = ctx.isStaff || (ctx.user.organizationId && ctx.user.organizationId === meeting.organizationId);
  if (!allowed) throw new StageError("NOT_FOUND", "Meeting not found.");
  return {
    fileName: `${meeting.title.replace(/[^\w]+/g, "-").slice(0, 40)}.ics`,
    ics: makeIcs({
      uid: meeting.id,
      title: meeting.title,
      start: meeting.startsAt,
      end: meeting.endsAt ?? new Date(meeting.startsAt.getTime() + 45 * 60_000),
      description: meeting.videoUrl ? `Join: ${meeting.videoUrl}` : "Your call with Wahala.",
      url: meeting.videoUrl,
    }),
  };
}

// ---------------------------------------------------------------- misc

/** Count for frame 48's live "N upcoming meetings stop syncing". */
export async function upcomingSyncedCount(ctx: AuthContext): Promise<number> {
  assertStaff(ctx, "upcoming_count");
  const rows = await getDb()
    .select({ id: schema.meetings.id, startsAt: schema.meetings.startsAt, syncedByUserId: schema.meetings.syncedByUserId })
    .from(schema.meetings)
    .where(eq(schema.meetings.status, "upcoming"));
  return rows.filter((r) => r.syncedByUserId === ctx.user.id && r.startsAt.getTime() > Date.now()).length;
}
