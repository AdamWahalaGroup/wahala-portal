/**
 * Messages — threaded, attributed comms (design frame 11 + the account thread).
 *
 * A thread is identified by a typed key:
 *   • account:<orgId>   — the durable client↔Wahala relationship line (project-less)
 *   • project:<projectId> — one per engagement
 * Stage-level discussion is intentionally NOT its own inbox (it lives on the stage).
 *
 * Reads are tenant- + visibility-scoped (clients never see internal messages);
 * posting is gated on org / project access.
 */
import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scopedDb } from "@/db/scoped";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";

export type WaitingOn = "none" | "client" | "wahala";
export type ThreadKind = "account" | "project";

export const accountKey = (orgId: string) => `account:${orgId}`;
export const projectKey = (projectId: string) => `project:${projectId}`;

export function parseThreadKey(key: string): { kind: ThreadKind; id: string } | null {
  const idx = key.indexOf(":");
  if (idx < 0) return null;
  const kind = key.slice(0, idx);
  const id = key.slice(idx + 1);
  if ((kind === "account" || kind === "project") && id) return { kind, id };
  return null;
}

export type Thread = {
  key: string;
  kind: ThreadKind;
  title: string;
  org: string | null; // shown as subtitle for staff (who span orgs)
  lastBody: string | null;
  lastAt: Date | null;
  waitingOn: WaitingOn;
  count: number;
};

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: Date;
  senderName: string;
  senderIsStaff: boolean;
  senderOrgName: string;
  waitingOn: WaitingOn;
};

/** Visibility predicate for messages (clients never see internal). */
function visibleMessages(ctx: AuthContext) {
  return ctx.canSeeInternal ? undefined : eq(schema.messages.visibility, "client_visible");
}

type Db = ReturnType<typeof getDb>;

/** Resolve sender attribution for a set of message rows. */
async function mapMessages(
  db: Db,
  rows: (typeof schema.messages.$inferSelect)[],
  orgName: string,
): Promise<ThreadMessage[]> {
  const senderIds = [...new Set(rows.map((r) => r.senderUserId).filter(Boolean))] as string[];
  const senders = senderIds.length
    ? await db
        .select({ id: schema.users.id, name: schema.users.name, userType: schema.users.userType })
        .from(schema.users)
        .where(inArray(schema.users.id, senderIds))
    : [];
  const byId = new Map(senders.map((s) => [s.id, s]));
  return rows.map((r) => {
    const s = r.senderUserId ? byId.get(r.senderUserId) : undefined;
    const isStaff = s?.userType === "wahala";
    return {
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      senderName: s?.name ?? "Unknown",
      senderIsStaff: isStaff,
      senderOrgName: isStaff ? "Wahala Group" : orgName,
      waitingOn: r.waitingOn as WaitingOn,
    };
  });
}

/** All threads in scope: an account thread per client org + a thread per project. */
export async function listThreads(ctx: AuthContext): Promise<Thread[]> {
  const sdb = scopedDb(ctx);
  const [projects, orgs] = await Promise.all([sdb.listProjects(), sdb.listOrganizations()]);
  const projectIds = projects.map((p) => p.id);
  const orgIds = orgs.map((o) => o.id);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  if (orgIds.length === 0) return [];

  const db = getDb();
  const scope = or(
    projectIds.length ? inArray(schema.messages.projectId, projectIds) : sql`0 = 1`,
    and(isNull(schema.messages.projectId), inArray(schema.messages.organizationId, orgIds)),
  ) as SQL;

  const rows = await db
    .select({
      projectId: schema.messages.projectId,
      organizationId: schema.messages.organizationId,
      body: schema.messages.body,
      waitingOn: schema.messages.waitingOn,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(and(scope, visibleMessages(ctx)))
    .orderBy(schema.messages.createdAt);

  const acct = new Map<string, typeof rows>();
  const proj = new Map<string, typeof rows>();
  for (const m of rows) {
    if (m.projectId) {
      const a = proj.get(m.projectId) ?? [];
      a.push(m);
      proj.set(m.projectId, a);
    } else if (m.organizationId) {
      const a = acct.get(m.organizationId) ?? [];
      a.push(m);
      acct.set(m.organizationId, a);
    }
  }

  const threads: Thread[] = [];
  for (const o of orgs) {
    const arr = acct.get(o.id) ?? [];
    const last = arr[arr.length - 1];
    threads.push({
      key: accountKey(o.id),
      kind: "account",
      title: ctx.isStaff ? o.name : "Wahala Group",
      org: ctx.isStaff ? o.name : null,
      lastBody: last?.body ?? null,
      lastAt: last?.createdAt ?? null,
      waitingOn: (last?.waitingOn ?? "none") as WaitingOn,
      count: arr.length,
    });
  }
  for (const p of projects) {
    const arr = proj.get(p.id) ?? [];
    const last = arr[arr.length - 1];
    threads.push({
      key: projectKey(p.id),
      kind: "project",
      title: p.name,
      org: ctx.isStaff ? orgName.get(p.organizationId) ?? null : null,
      lastBody: last?.body ?? null,
      lastAt: last?.createdAt ?? null,
      waitingOn: (last?.waitingOn ?? "none") as WaitingOn,
      count: arr.length,
    });
  }

  threads.sort((a, b) => {
    if (a.lastAt && b.lastAt) return +new Date(b.lastAt) - +new Date(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    if (a.kind !== b.kind) return a.kind === "account" ? -1 : 1; // empty: account before project
    return a.title.localeCompare(b.title);
  });
  return threads;
}

/** A single thread's messages (or null if the key is invalid / out of scope). */
export async function getThread(
  ctx: AuthContext,
  key: string,
): Promise<{ key: string; kind: ThreadKind; title: string; org: string; waitingOn: WaitingOn; messages: ThreadMessage[] } | null> {
  const parsed = parseThreadKey(key);
  if (!parsed) return null;
  const db = getDb();
  const sdb = scopedDb(ctx);

  if (parsed.kind === "project") {
    const project = await sdb.getProject(parsed.id);
    if (!project) return null;
    const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, project.organizationId) });
    const orgName = org?.name ?? "—";
    const rows = await db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.projectId, parsed.id), visibleMessages(ctx)))
      .orderBy(schema.messages.createdAt);
    return {
      key,
      kind: "project",
      title: project.name,
      org: orgName,
      waitingOn: (rows[rows.length - 1]?.waitingOn ?? "none") as WaitingOn,
      messages: await mapMessages(db, rows, orgName),
    };
  }

  // account thread — the org must be in scope.
  const orgs = await sdb.listOrganizations();
  const org = orgs.find((o) => o.id === parsed.id);
  if (!org) return null;
  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.organizationId, parsed.id), isNull(schema.messages.projectId), visibleMessages(ctx)))
    .orderBy(schema.messages.createdAt);
  return {
    key,
    kind: "account",
    title: ctx.isStaff ? org.name : "Wahala Group",
    org: org.name,
    waitingOn: (rows[rows.length - 1]?.waitingOn ?? "none") as WaitingOn,
    messages: await mapMessages(db, rows, org.name),
  };
}

/** Post to a thread (account or project). Gated on org / project access. */
export async function postMessage(
  ctx: AuthContext,
  input: { threadKey: string; body: string; waitingOn?: WaitingOn },
): Promise<void> {
  const parsed = parseThreadKey(input.threadKey);
  if (!parsed) throw new StageError("VALIDATION", "Unknown thread.");

  const body = input.body?.trim();
  if (!body) throw new StageError("VALIDATION", "A message can't be empty.");
  const waitingOn: WaitingOn = input.waitingOn === "client" || input.waitingOn === "wahala" ? input.waitingOn : "none";

  let organizationId: string;
  let projectId: string | null = null;
  const sdb = scopedDb(ctx);

  if (parsed.kind === "project") {
    const project = await sdb.getProject(parsed.id);
    if (!project) throw new StageError("NOT_FOUND", "Project not found.");
    organizationId = project.organizationId;
    projectId = project.id;
  } else {
    const orgs = await sdb.listOrganizations();
    const org = orgs.find((o) => o.id === parsed.id);
    if (!org) throw new StageError("NOT_FOUND", "Client not found.");
    organizationId = org.id;
  }

  await getDb().insert(schema.messages).values({
    organizationId,
    projectId,
    senderUserId: ctx.user.id,
    body,
    visibility: "client_visible",
    waitingOn,
  });
}
