/**
 * SLA nudges — the pure engine behind the scheduled job (cron/index.ts).
 *
 * `runNudges(db, env, now)` takes its Drizzle client + env EXPLICITLY (no
 * getCloudflareContext / no Next imports) so the standalone cron Worker can bundle it.
 * Relative imports below are deliberate: the cron bundle resolves them without the
 * `@/` tsconfig alias.
 *
 * It (1) finds stuck deals, un-answered proposals, and overdue leads using the saved
 * SLA thresholds, (2) upserts in-app notifications for the responsible staff (deduped),
 * (3) emails owners once when an item passes the escalation window, and (4) emails
 * admins a digest on their chosen cadence.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { resolveSla, isStuckWith, stuckDaysForStage, isLeadOverdue, type SlaSettings } from "../domain/sla";
import { daysInStage, type DealStage } from "../domain/sales";
import { sendEmail, type EmailEnv } from "../auth/send-email";

type Db = DrizzleD1Database<typeof schema>;
type Kind = (typeof schema.NOTIFICATION_KINDS)[number];

const APP_BASE = "https://portal.wahala-services.com";
const LAST_DIGEST_KEY = "nudge:lastDigestDate";

/** One actionable item. userId null = no staff recipient (still counted in the digest). */
export type Nudge = {
  kind: Kind;
  entityType: "deal" | "proposal" | "lead" | "contact";
  entityId: string;
  userId: string | null;
  href: string;
  title: string;
  body: string;
  /** Days past the item's threshold — drives escalation timing. */
  overdueDays: number;
};

// ---------------------------------------------------------------- pure selection (unit-tested)

type DealRow = { id: string; name: string; stage: DealStage; stageEnteredAt: Date; ownerUserId: string | null };
type ProposalRow = { id: string; version: number; dealId: string; status: string; sentAt: Date | null; respondedAt: Date | null };
type TriageContactRow = { id: string; name: string; state: string; createdAt: Date; assignedToUserId: string | null };

export function selectStuckDeals(deals: DealRow[], sla: SlaSettings, now: Date): Nudge[] {
  return deals
    .filter((d) => isStuckWith(d.stage, d.stageEnteredAt, now, sla))
    .map((d) => {
      const days = daysInStage(d.stageEnteredAt, now);
      return {
        kind: "deal_stuck" as const,
        entityType: "deal" as const,
        entityId: d.id,
        userId: d.ownerUserId,
        href: `${APP_BASE}/dashboard/sales/deals/${d.id}`,
        title: `Deal stuck: ${d.name}`,
        body: `In its stage ${days} days (window ${stuckDaysForStage(d.stage, sla)}d). Nudge it or log why.`,
        overdueDays: days - stuckDaysForStage(d.stage, sla),
      };
    });
}

export function selectFollowupProposals(
  proposals: (ProposalRow & { dealName: string; ownerUserId: string | null })[],
  sla: SlaSettings,
  now: Date,
): Nudge[] {
  return proposals
    .filter((p) => p.status === "sent" && !p.respondedAt && p.sentAt && daysInStage(p.sentAt, now) >= sla.proposalFollowupDays)
    .map((p) => {
      const days = daysInStage(p.sentAt as Date, now);
      return {
        kind: "proposal_followup" as const,
        entityType: "proposal" as const,
        entityId: p.id,
        userId: p.ownerUserId,
        href: `${APP_BASE}/dashboard/sales/proposals/${p.id}`,
        title: `Proposal needs follow-up: ${p.dealName}`,
        body: `Sent ${days} days ago (window ${sla.proposalFollowupDays}d) with no client response. Follow up.`,
        overdueDays: days - sla.proposalFollowupDays,
      };
    });
}

/** "Lead" is the to_qualify STATE on a contact; the notification kind keeps its
 * stored name (lead_overdue) for continuity with existing rows. */
export function selectOverdueLeads(contacts: TriageContactRow[], sla: SlaSettings, now: Date): Nudge[] {
  return contacts
    .filter((c) => c.state === "to_qualify" && isLeadOverdue(c.createdAt, now, sla))
    .map((c) => {
      const days = daysInStage(c.createdAt, now);
      return {
        kind: "lead_overdue" as const,
        entityType: "contact" as const,
        entityId: c.id,
        userId: c.assignedToUserId,
        href: `${APP_BASE}/dashboard/sales/contacts/${c.id}`,
        title: `Contact awaiting triage: ${c.name}`,
        body: `Captured ${days} days ago (window ${sla.leadTriageDays}d) and still unqualified.`,
        overdueDays: days - sla.leadTriageDays,
      };
    });
}

/** Cadence gate: does today warrant a digest send? (Monday = getDay() 1.) */
export function shouldSendDigest(cadence: SlaSettings["nudge"]["adminDigest"], now: Date, lastSentDate: string | null): boolean {
  if (cadence === "off") return false;
  const today = ymd(now);
  if (lastSentDate === today) return false; // already sent today
  if (cadence === "daily") return true;
  return now.getUTCDay() === 1; // "monday"
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- orchestration (db IO)

export async function runNudges(db: Db, env: EmailEnv, now: Date): Promise<{ nudges: number; notified: number; escalated: number; digestSent: boolean }> {
  const sla = resolveSla((await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "sla")).get())?.value ?? null);

  // Load the source rows.
  const [deals, sentProposals, triageContacts] = await Promise.all([
    db.select().from(schema.deals).all(),
    db.select().from(schema.proposals).where(eq(schema.proposals.status, "sent")).all(),
    db.select().from(schema.contacts).where(eq(schema.contacts.state, "to_qualify")).all(),
  ]);

  // Join proposals → their deal (name + owner).
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const propInputs = sentProposals.map((p) => ({
    id: p.id,
    version: p.version,
    dealId: p.dealId,
    status: p.status,
    sentAt: p.sentAt,
    respondedAt: p.respondedAt,
    dealName: dealById.get(p.dealId)?.name ?? "Untitled deal",
    ownerUserId: dealById.get(p.dealId)?.ownerUserId ?? null,
  }));

  const nudges: Nudge[] = [
    ...selectStuckDeals(deals as DealRow[], sla, now),
    ...selectFollowupProposals(propInputs, sla, now),
    ...selectOverdueLeads(triageContacts as TriageContactRow[], sla, now),
  ];

  let notified = 0;
  let escalated = 0;

  // Load existing rows for the three kinds so we can dedupe + auto-resolve.
  const existing = await db
    .select()
    .from(schema.notifications)
    .where(inArray(schema.notifications.kind, [...schema.NOTIFICATION_KINDS]))
    .all();
  const activeKey = new Set(nudges.map((n) => `${n.kind}:${n.entityId}`));

  // Auto-resolve: mark read any unread nudge whose condition no longer holds.
  const staleUnread = existing.filter((r) => !r.readAt && !activeKey.has(`${r.kind}:${r.entityId}`));
  if (staleUnread.length > 0) {
    await db
      .update(schema.notifications)
      .set({ readAt: now })
      .where(inArray(schema.notifications.id, staleUnread.map((r) => r.id)))
      .run();
  }

  if (sla.nudge.notifyOwnerInApp) {
    const unreadKey = new Set(existing.filter((r) => !r.readAt).map((r) => `${r.userId}:${r.kind}:${r.entityId}`));
    const toInsert = nudges
      .filter((n): n is Nudge & { userId: string } => !!n.userId)
      .filter((n) => !unreadKey.has(`${n.userId}:${n.kind}:${n.entityId}`))
      .map((n) => ({
        userId: n.userId,
        kind: n.kind,
        entityType: n.entityType,
        entityId: n.entityId,
        href: n.href,
        title: n.title,
        body: n.body,
      }));
    if (toInsert.length > 0) {
      await db.insert(schema.notifications).values(toInsert).run();
      notified = toInsert.length;
    }

    // Escalation email: item past stuck window + escalateEmailDays, not yet emailed.
    const escDays = sla.nudge.escalateEmailDays;
    if (escDays !== null) {
      // Re-read rows (now includes the just-inserted) that match active nudges and are un-emailed.
      const rows = await db
        .select()
        .from(schema.notifications)
        .where(and(inArray(schema.notifications.kind, [...schema.NOTIFICATION_KINDS]), isNull(schema.notifications.emailedAt)))
        .all();
      const nudgeByEntity = new Map(nudges.map((n) => [`${n.kind}:${n.entityId}`, n]));
      const userEmail = await loadUserEmails(db, rows.map((r) => r.userId));
      for (const r of rows) {
        const n = nudgeByEntity.get(`${r.kind}:${r.entityId}`);
        if (!n || n.overdueDays < escDays) continue;
        const to = userEmail.get(r.userId);
        if (!to) continue;
        await sendEmail(env, {
          to,
          subject: `Action needed: ${r.title}`,
          text: `${r.title}\n\n${r.body}\n\nOpen it: ${r.href}`,
          html: `<p><strong>${escapeHtml(r.title)}</strong></p><p>${escapeHtml(r.body)}</p><p><a href="${r.href}">Open in Wahala Portal</a></p>`,
        });
        await db.update(schema.notifications).set({ emailedAt: now }).where(eq(schema.notifications.id, r.id)).run();
        escalated++;
      }
    }
  }

  // Admin digest.
  let digestSent = false;
  const lastSent = (await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, LAST_DIGEST_KEY)).get())?.value as
    | { date?: string }
    | undefined;
  if (shouldSendDigest(sla.nudge.adminDigest, now, lastSent?.date ?? null) && nudges.length > 0) {
    const admins = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(and(eq(schema.users.role, "wahala_admin"), eq(schema.users.status, "active")))
      .all();
    if (admins.length > 0) {
      const { subject, text, html } = buildDigest(nudges);
      for (const a of admins) await sendEmail(env, { to: a.email, subject, text, html });
      digestSent = true;
    }
    // Stamp even if there were no admins, so we don't re-check all day.
    await upsertSetting(db, LAST_DIGEST_KEY, { date: ymd(now) });
  }

  return { nudges: nudges.length, notified, escalated, digestSent };
}

// ---------------------------------------------------------------- helpers

async function loadUserEmails(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, unique)).all();
  return new Map(rows.map((r) => [r.id, r.email]));
}

async function upsertSetting(db: Db, key: string, value: unknown): Promise<void> {
  const existing = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).get();
  if (existing) await db.update(schema.appSettings).set({ value }).where(eq(schema.appSettings.key, key)).run();
  else await db.insert(schema.appSettings).values({ key, value }).run();
}

export function buildDigest(nudges: Nudge[]): { subject: string; text: string; html: string } {
  const stuck = nudges.filter((n) => n.kind === "deal_stuck");
  const props = nudges.filter((n) => n.kind === "proposal_followup");
  const leads = nudges.filter((n) => n.kind === "lead_overdue");
  const subject = `Wahala pipeline — ${nudges.length} need${nudges.length === 1 ? "s" : ""} attention`;

  const section = (emoji: string, label: string, items: Nudge[]) =>
    items.length === 0 ? "" : `\n${emoji} ${label} (${items.length})\n${items.map((n) => `  • ${n.title.replace(/^[^:]+: /, "")} — ${n.body}`).join("\n")}\n`;
  const text = `Items over their SLA window:\n${section("⚠", "Stuck deals", stuck)}${section("⏳", "Proposal follow-up", props)}${section("◆", "Contacts to triage", leads)}\nOpen the board: ${APP_BASE}/dashboard/sales`;

  const htmlSection = (label: string, items: Nudge[], color: string) =>
    items.length === 0
      ? ""
      : `<h3 style="color:${color};margin:16px 0 6px">${label} (${items.length})</h3><ul style="margin:0;padding-left:18px">${items
          .map((n) => `<li style="margin:4px 0"><a href="${n.href}">${escapeHtml(n.title.replace(/^[^:]+: /, ""))}</a> — ${escapeHtml(n.body)}</li>`)
          .join("")}</ul>`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#16181d"><p>Items over their SLA window:</p>${htmlSection(
    "⚠ Stuck deals",
    stuck,
    "#b45309",
  )}${htmlSection("⏳ Proposal follow-up", props, "#2b3ee6")}${htmlSection("◆ Contacts to triage", leads, "#15803d")}<p style="margin-top:16px"><a href="${APP_BASE}/dashboard/sales">Open the board →</a></p></div>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}
