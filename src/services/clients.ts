/**
 * Client onboarding — Wahala admins onboard a prospect (org + primary contact),
 * then invite them. The contact starts "invited" and flips to "active" (= Accepted)
 * on first sign-in. Clients never self-signup.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { StageError } from "@/domain/stage-machine";
import { buildAudit } from "@/services/audit";
import { securityLog } from "@/lib/security-log";
import { createMagicToken } from "@/auth/magic-link";
import { sendInviteEmail } from "@/auth/email";
import { isDevAuth } from "@/auth/server-env";

export type ClientListItem = {
  org: { id: string; name: string; status: string; intakeNotes: string | null; createdAt: Date };
  contact: { name: string; email: string; status: "invited" | "active" | "disabled" } | null;
};

/** Client orgs the caller may see, each with its primary contact + invite status. */
export async function listClients(ctx: AuthContext): Promise<ClientListItem[]> {
  const db = getDb();
  const scope = ctx.accessScope;

  let orgs: (typeof schema.organizations.$inferSelect)[];
  if (scope.kind === "all") {
    orgs = await db.select().from(schema.organizations);
  } else if (scope.orgIds.length === 0) {
    return [];
  } else {
    orgs = await db.select().from(schema.organizations).where(inArray(schema.organizations.id, scope.orgIds));
  }
  if (orgs.length === 0) return [];

  const orgIds = orgs.map((o) => o.id);
  const clientUsers = await db
    .select({
      organizationId: schema.users.organizationId,
      name: schema.users.name,
      email: schema.users.email,
      status: schema.users.status,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(and(eq(schema.users.userType, "client"), inArray(schema.users.organizationId, orgIds)));

  const byOrg = new Map<string, typeof clientUsers>();
  for (const u of clientUsers) {
    if (!u.organizationId) continue;
    const arr = byOrg.get(u.organizationId) ?? [];
    arr.push(u);
    byOrg.set(u.organizationId, arr);
  }

  return orgs
    .map((o) => {
      const users = byOrg.get(o.id) ?? [];
      const contact = users.find((u) => u.role === "client_admin") ?? users[0] ?? null;
      return {
        org: { id: o.id, name: o.name, status: o.status, intakeNotes: o.intakeNotes, createdAt: o.createdAt },
        contact: contact ? { name: contact.name, email: contact.email, status: contact.status } : null,
      };
    })
    .sort((a, b) => +new Date(b.org.createdAt) - +new Date(a.org.createdAt));
}

/** Active Wahala staff — candidates to own a client relationship (the "agent" selector). */
export async function listWahalaStaff(ctx: AuthContext): Promise<{ id: string; name: string }[]> {
  if (!ctx.isStaff) return [];
  const db = getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.userType, "wahala"), ne(schema.users.status, "disabled")))
    .orderBy(schema.users.name);
}

/**
 * Onboard a prospect: create the org + primary client contact (invited), assign an
 * Account Owner (the chosen Wahala "agent", defaulting to the inviting admin), and
 * send/return the invite link. Admin only.
 */
export async function onboardClient(
  ctx: AuthContext,
  input: {
    organizationName: string;
    contactName: string;
    contactEmail: string;
    intakeNotes?: string;
    assignedAgentId?: string;
  },
  origin: string,
): Promise<{ organizationId: string; userId: string; inviteLink?: string }> {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "onboard_client", reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can onboard a client.");
  }

  const organizationName = input.organizationName?.trim();
  const contactName = input.contactName?.trim();
  const contactEmail = input.contactEmail?.trim().toLowerCase();
  if (!organizationName || !contactName || !contactEmail || !contactEmail.includes("@")) {
    throw new StageError("VALIDATION", "Company, contact name, and a valid contact email are required.");
  }

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, contactEmail) });
  if (existing) throw new StageError("VALIDATION", "A user with that email already exists.");

  // Account owner = the chosen Wahala agent (defaults to the inviting admin).
  let accountOwnerUserId = ctx.user.id;
  if (input.assignedAgentId && input.assignedAgentId !== ctx.user.id) {
    const agent = await db.query.users.findFirst({ where: eq(schema.users.id, input.assignedAgentId) });
    if (!agent || agent.userType !== "wahala" || agent.status === "disabled") {
      throw new StageError("VALIDATION", "The assigned agent must be an active Wahala user.");
    }
    accountOwnerUserId = agent.id;
  }

  const organizationId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const now = new Date();

  await db.batch([
    db.insert(schema.organizations).values({
      id: organizationId,
      name: organizationName,
      status: "prospect",
      intakeNotes: input.intakeNotes?.trim() || null,
      accountOwnerUserId, // the chosen Wahala agent (default: inviting admin)
      ownerAssignedAt: now,
      ownerAcceptedAt: now,
    }),
    db.insert(schema.users).values({
      id: userId,
      organizationId,
      userType: "client",
      role: "client_admin",
      name: contactName,
      email: contactEmail,
      status: "invited",
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId,
        actorUserId: ctx.user.id,
        action: "client.onboarded",
        entityType: "organization",
        entityId: organizationId,
        metadata: { organizationName, contactEmail },
      }),
    ),
  ]);

  // Invite = a magic link the client clicks to accept + sign in.
  const token = await createMagicToken({ userId, email: contactEmail });
  const url = new URL(`/api/auth/verify?token=${token}`, origin).toString();
  let inviteLink: string | undefined;
  if (isDevAuth()) {
    inviteLink = url;
    console.log(`[invite] ${contactEmail}: ${url}`);
  } else {
    try {
      await sendInviteEmail(contactEmail, url, organizationName);
    } catch (err) {
      console.error("[invite] email send failed:", err);
    }
  }

  return { organizationId, userId, inviteLink };
}

/**
 * Delete a client org and EVERYTHING under it (admin only) — for resetting test
 * data. Deletes in FK-dependency order so the cascade never trips a constraint.
 * Staff users (no org) are never touched; only this org's client users go.
 */
export async function deleteOrganization(ctx: AuthContext, orgId: string): Promise<void> {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "delete_org", resource: `org:${orgId}`, reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can delete a client.");
  }
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Organization not found.");

  const taskIds = db.select({ id: schema.tasks.id }).from(schema.tasks).where(eq(schema.tasks.organizationId, orgId));
  const stageIds = db.select({ id: schema.stages.id }).from(schema.stages).where(eq(schema.stages.organizationId, orgId));
  const lineItemIds = db.select({ id: schema.stageLineItems.id }).from(schema.stageLineItems).where(inArray(schema.stageLineItems.stageId, stageIds));

  await db.batch([
    db.delete(schema.taskAssignments).where(inArray(schema.taskAssignments.taskId, taskIds)),
    db.delete(schema.taskSubtasks).where(inArray(schema.taskSubtasks.taskId, taskIds)),
    db.delete(schema.taskNotes).where(inArray(schema.taskNotes.taskId, taskIds)),
    db.delete(schema.tasks).where(eq(schema.tasks.organizationId, orgId)),
    db.delete(schema.deliverableNotes).where(inArray(schema.deliverableNotes.stageLineItemId, lineItemIds)),
    db.delete(schema.stageLineItems).where(inArray(schema.stageLineItems.stageId, stageIds)),
    db.delete(schema.stages).where(eq(schema.stages.organizationId, orgId)),
    db.delete(schema.changeOrders).where(eq(schema.changeOrders.organizationId, orgId)),
    db.delete(schema.assets).where(eq(schema.assets.organizationId, orgId)),
    db.delete(schema.messages).where(eq(schema.messages.organizationId, orgId)),
    db.delete(schema.projectMembers).where(eq(schema.projectMembers.organizationId, orgId)),
    db.delete(schema.projects).where(eq(schema.projects.organizationId, orgId)),
    db.delete(schema.auditLog).where(eq(schema.auditLog.organizationId, orgId)),
    db.delete(schema.users).where(eq(schema.users.organizationId, orgId)),
    db.delete(schema.organizations).where(eq(schema.organizations.id, orgId)),
  ]);

  securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "delete_org", resource: `org:${orgId}`, reason: "admin_cascade_delete" });
}
