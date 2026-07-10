/**
 * Account hub (design frame 12) — the durable staff-facing home for ONE client org:
 * org header, lifetime totals, a work-history timeline across all its projects, and
 * the people (client roster + the Wahala team on the account).
 *
 * Reads go through scopedDb so tenant + project scope still apply (an admin sees the
 * whole org; an account owner only orgs they own; a project-scoped engineer only their
 * projects). The org roster is then read directly — reaching this point means the org
 * is already authorized for the caller.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { scopedDb } from "@/db/scoped";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import type { StageStatus } from "@/domain/stage-machine";
import { derivedProjectStatus, type DerivedProjectStatus } from "@/domain/project-status";
import { STATUS_STYLES } from "@/lib/theme";

const PAID_OR_BEYOND = new Set<StageStatus>(["paid", "in_progress", "delivered", "accepted"]);
const OPEN_PIPELINE = new Set<StageStatus>(["quoted", "approved"]);

export type WorkHistoryItem = {
  stageId: string;
  projectName: string;
  stageName: string;
  status: StageStatus;
  amountCents: number;
  at: Date;
  atLabel: string;
};

export type HubPerson = { id: string; name: string; email: string; role: string; status: string };

export type AccountHub = {
  org: { id: string; name: string; status: string; intakeNotes: string | null; aiContextMd: string | null; createdAt: Date };
  accountOwner: { id: string; name: string; email: string } | null;
  counts: { projects: number; stages: number };
  totals: { paidCents: number; acceptedCents: number; openCents: number };
  projects: { id: string; name: string; workType: string | null; status: string; derived: DerivedProjectStatus; latestStatus: StageStatus | null }[];
  history: WorkHistoryItem[];
  clientPeople: HubPerson[];
  wahalaPeople: { id: string; name: string; role: string }[];
};

/** The most meaningful timestamp + label for a stage's timeline node. */
function nodeMoment(s: typeof schema.stages.$inferSelect): { at: Date; label: string } {
  // Label always reflects the stage's CURRENT status (so an in-progress, paid stage
  // reads "In progress", not "Paid"); pick the most relevant timestamp for it.
  const label = STATUS_STYLES[s.status].label;
  let at = s.updatedAt;
  if (s.status === "accepted" && s.acceptedAt) at = s.acceptedAt;
  else if (s.status === "delivered" && s.deliveredAt) at = s.deliveredAt;
  else if (s.status === "paid" && s.paidAt) at = s.paidAt;
  return { at, label };
}

/** Assemble the full account hub for one org, or throw NOT_FOUND if out of scope. */
export async function getAccountHub(ctx: AuthContext, orgId: string): Promise<AccountHub> {
  if (!ctx.isStaff) throw new StageError("FORBIDDEN", "Staff only.");

  const sdb = scopedDb(ctx);
  const [orgs, projects, stages] = await Promise.all([
    sdb.listOrganizations(), // scope check: only orgs the caller may reach
    sdb.listProjects(), // tenant + project scope
    sdb.listAllStages(), // tenant + project scope
  ]);

  const org = orgs.find((o) => o.id === orgId);
  if (!org) throw new StageError("NOT_FOUND", "Client not found.");

  const orgProjects = projects.filter((p) => p.organizationId === orgId);
  const orgStages = stages.filter((s) => s.organizationId === orgId);
  const projName = new Map(orgProjects.map((p) => [p.id, p.name]));

  // Latest stage status per project (stages came back newest-first from listAllStages).
  const latest = new Map<string, StageStatus>();
  for (const s of orgStages) if (!latest.has(s.projectId)) latest.set(s.projectId, s.status);

  const totals = {
    paidCents: orgStages.filter((s) => PAID_OR_BEYOND.has(s.status)).reduce((a, s) => a + s.totalAmountCents, 0),
    acceptedCents: orgStages.filter((s) => s.status === "accepted").reduce((a, s) => a + s.totalAmountCents, 0),
    openCents: orgStages.filter((s) => OPEN_PIPELINE.has(s.status)).reduce((a, s) => a + s.totalAmountCents, 0),
  };

  const history: WorkHistoryItem[] = orgStages
    .map((s) => {
      const m = nodeMoment(s);
      return {
        stageId: s.id,
        projectName: projName.get(s.projectId) ?? "Project",
        stageName: s.name,
        status: s.status,
        amountCents: s.totalAmountCents,
        at: m.at,
        atLabel: m.label,
      };
    })
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // Org roster (the client-side people) — authorized: the org is in scope.
  const db = getDb();
  const clientUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
    })
    .from(schema.users)
    .where(and(eq(schema.users.organizationId, orgId), eq(schema.users.userType, "client")))
    .orderBy(schema.users.name);

  // Wahala team on the account: the account owner + any project lead engineers.
  const wahalaIds = new Map<string, string>(); // userId → role label
  if (org.accountOwnerUserId) wahalaIds.set(org.accountOwnerUserId, "Account owner");
  for (const p of orgProjects) {
    if (p.leadEngineerUserId && !wahalaIds.has(p.leadEngineerUserId)) {
      wahalaIds.set(p.leadEngineerUserId, "Lead engineer");
    }
  }
  const wahalaPeople: { id: string; name: string; role: string }[] = [];
  let accountOwner: AccountHub["accountOwner"] = null;
  if (wahalaIds.size > 0) {
    const ids = [...wahalaIds.keys()];
    const rows = await db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.userType, "wahala"));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of ids) {
      const u = byId.get(id);
      if (!u) continue;
      wahalaPeople.push({ id: u.id, name: u.name, role: wahalaIds.get(id)! });
      if (id === org.accountOwnerUserId) accountOwner = u;
    }
  }

  return {
    org: { id: org.id, name: org.name, status: org.status, intakeNotes: org.intakeNotes, aiContextMd: org.aiContextMd, createdAt: org.createdAt },
    accountOwner,
    counts: { projects: orgProjects.length, stages: orgStages.length },
    totals,
    projects: orgProjects.map((p) => ({
      id: p.id,
      name: p.name,
      workType: p.workType,
      status: p.status,
      // Honest label — projects.status is dead bookkeeping (never leaves "discovery").
      derived: derivedProjectStatus(orgStages.filter((s) => s.projectId === p.id).map((s) => s.status)),
      latestStatus: latest.get(p.id) ?? null,
    })),
    history,
    clientPeople: clientUsers,
    wahalaPeople,
  };
}
