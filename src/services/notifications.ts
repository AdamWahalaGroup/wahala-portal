/**
 * In-app notifications — staff-facing nudges written by the scheduled job
 * (services/nudges.ts) and read here through the bell in the AppShell.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { assertStaff } from "@/services/sales";

export type NotificationItem = {
  id: string;
  kind: (typeof schema.NOTIFICATION_KINDS)[number];
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
};

const LIMIT = 30;

export async function listForUser(ctx: AuthContext): Promise<{ items: NotificationItem[]; unread: number }> {
  assertStaff(ctx, "list_notifications");
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, ctx.user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(LIMIT);
  const items = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
  return { items, unread: items.filter((r) => !r.readAt).length };
}

/** Mark the given notifications (or all of this user's unread) as read. Own rows only. */
export async function markRead(ctx: AuthContext, ids?: string[]): Promise<void> {
  assertStaff(ctx, "mark_notifications_read");
  const db = getDb();
  const own = eq(schema.notifications.userId, ctx.user.id);
  const where = ids && ids.length > 0 ? and(own, inArray(schema.notifications.id, ids)) : and(own, isNull(schema.notifications.readAt));
  await db.update(schema.notifications).set({ readAt: new Date() }).where(where);
}
