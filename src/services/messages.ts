/**
 * Messages — threaded, attributed comms (design frame 11). A "thread" is a project:
 * its messages, flagged Waiting on you / Wahala. Reads are tenant- + visibility-scoped
 * (clients never see internal messages); posting is gated on project access.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scopedDb } from "@/db/scoped";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";

export type WaitingOn = "none" | "client" | "wahala";

export type Thread = {
  projectId: string;
  projectName: string;
  organizationName: string | null; // shown for staff (who span orgs)
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

/** One thread per project in scope, newest-active first. */
export async function listThreads(ctx: AuthContext): Promise<Thread[]> {
  const projects = await scopedDb(ctx).listProjects();
  if (projects.length === 0) return [];
  const projectIds = projects.map((p) => p.id);
  const db = getDb();

  const msgs = await db
    .select({
      projectId: schema.messages.projectId,
      body: schema.messages.body,
      waitingOn: schema.messages.waitingOn,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(and(inArray(schema.messages.projectId, projectIds), visibleMessages(ctx)))
    .orderBy(schema.messages.createdAt);

  const byProject = new Map<string, typeof msgs>();
  for (const m of msgs) {
    if (!m.projectId) continue;
    const arr = byProject.get(m.projectId) ?? [];
    arr.push(m);
    byProject.set(m.projectId, arr);
  }

  const orgName = new Map<string, string>();
  if (ctx.isStaff) {
    const orgIds = [...new Set(projects.map((p) => p.organizationId))];
    const orgs = await db
      .select({ id: schema.organizations.id, name: schema.organizations.name })
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, orgIds));
    for (const o of orgs) orgName.set(o.id, o.name);
  }

  const threads: Thread[] = projects.map((p) => {
    const arr = byProject.get(p.id) ?? [];
    const last = arr[arr.length - 1];
    return {
      projectId: p.id,
      projectName: p.name,
      organizationName: ctx.isStaff ? orgName.get(p.organizationId) ?? null : null,
      lastBody: last?.body ?? null,
      lastAt: last?.createdAt ?? null,
      waitingOn: (last?.waitingOn ?? "none") as WaitingOn,
      count: arr.length,
    };
  });

  threads.sort((a, b) => {
    if (a.lastAt && b.lastAt) return +new Date(b.lastAt) - +new Date(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    return a.projectName.localeCompare(b.projectName);
  });
  return threads;
}

/** A single project's messages (or null if out of scope). */
export async function getThread(
  ctx: AuthContext,
  projectId: string,
): Promise<{ projectName: string; organizationName: string; waitingOn: WaitingOn; messages: ThreadMessage[] } | null> {
  const project = await scopedDb(ctx).getProject(projectId);
  if (!project) return null;
  const db = getDb();

  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, project.organizationId) });
  const orgName = org?.name ?? "—";

  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.projectId, projectId), visibleMessages(ctx)))
    .orderBy(schema.messages.createdAt);

  const senderIds = [...new Set(rows.map((r) => r.senderUserId).filter(Boolean))] as string[];
  const senders = senderIds.length
    ? await db
        .select({ id: schema.users.id, name: schema.users.name, userType: schema.users.userType })
        .from(schema.users)
        .where(inArray(schema.users.id, senderIds))
    : [];
  const byId = new Map(senders.map((s) => [s.id, s]));

  const messages: ThreadMessage[] = rows.map((r) => {
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

  return {
    projectName: project.name,
    organizationName: orgName,
    waitingOn: (rows[rows.length - 1]?.waitingOn ?? "none") as WaitingOn,
    messages,
  };
}

/** Post a message to a project thread. Gated on project access; client-visible. */
export async function postMessage(
  ctx: AuthContext,
  input: { projectId: string; body: string; waitingOn?: WaitingOn },
): Promise<void> {
  const project = await scopedDb(ctx).getProject(input.projectId);
  if (!project) throw new StageError("NOT_FOUND", "Project not found.");

  const body = input.body?.trim();
  if (!body) throw new StageError("VALIDATION", "A message can't be empty.");

  const waitingOn: WaitingOn = input.waitingOn === "client" || input.waitingOn === "wahala" ? input.waitingOn : "none";

  await getDb().insert(schema.messages).values({
    organizationId: project.organizationId,
    projectId: project.id,
    senderUserId: ctx.user.id,
    body,
    visibility: "client_visible",
    waitingOn,
  });
}
