/**
 * Client onboarding — Wahala admins onboard a prospect (org + primary contact),
 * then invite them. The contact starts "invited" and flips to "active" (= Accepted)
 * on first sign-in. Clients never self-signup.
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AuthContext } from "@/auth/context";
import { canAccessOrg } from "@/auth/access";
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
 * Set the per-client AI memory (organizations.ai_context_md). Editable by Wahala
 * admins or that org's Account Owner — same RBAC as createProject. Future AI features
 * read this as grounding so they don't have to re-read the source docs each time.
 */
export async function setOrgAiContextMd(ctx: AuthContext, orgId: string, body: string): Promise<void> {
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Organization not found.");
  if (!canAccessOrg(ctx.accessScope, org.id)) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "set_org_ai_context", resource: `org:${orgId}`, reason: "out_of_scope" });
    throw new StageError("NOT_FOUND", "Organization not found.");
  }
  const isOwner = ctx.user.id === org.accountOwnerUserId;
  if (!(ctx.isAdmin || (ctx.user.role === "account_owner" && isOwner))) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "set_org_ai_context", resource: `org:${orgId}`, reason: "not_admin_or_owner" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or this client's Account Owner can edit the client memory.");
  }
  const trimmed = body.trim();
  await db
    .update(schema.organizations)
    .set({ aiContextMd: trimmed.length > 0 ? trimmed : null })
    .where(eq(schema.organizations.id, orgId));
}

// ---------------------------------------------------------------- portal invites (frame 35)

export type PortalRole = "client_admin" | "client_billing" | "client_readonly";
const PORTAL_ROLES: readonly PortalRole[] = ["client_admin", "client_billing", "client_readonly"];

/**
 * Invite CONTACTS onto an account's portal (frame 35 — the invite moment moved out
 * of the retired Clients screen into the deal→project handoff and the Account page).
 * Reuses the existing invite machinery: user row (invited) + magic-link email.
 * Skips contacts whose email already has a user. Admin / account owner.
 */
export async function invitePortalContacts(
  ctx: AuthContext,
  orgId: string,
  invites: { contactId: string; role: PortalRole }[],
  origin: string,
): Promise<{ invited: number; skipped: string[]; inviteLinks?: Record<string, string> }> {
  if (!(ctx.isAdmin || ctx.user.role === "account_owner")) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "invite_portal_contacts", reason: "not_admin_or_owner" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin or account owner can send portal invites.");
  }
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Account not found.");
  if (invites.length === 0) throw new StageError("VALIDATION", "Pick at least one contact to invite.");

  let invited = 0;
  const skipped: string[] = [];
  const inviteLinks: Record<string, string> = {};

  for (const inv of invites) {
    const role: PortalRole = PORTAL_ROLES.includes(inv.role) ? inv.role : "client_admin";
    const contact = await db.query.contacts.findFirst({ where: eq(schema.contacts.id, inv.contactId) });
    if (!contact?.email) {
      skipped.push(contact?.name ?? inv.contactId);
      continue;
    }
    const email = contact.email.trim().toLowerCase();
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (existing) {
      skipped.push(contact.name);
      continue;
    }
    const userId = crypto.randomUUID();
    await db.batch([
      db.insert(schema.users).values({
        id: userId,
        organizationId: orgId,
        userType: "client",
        role,
        name: contact.name,
        email,
        status: "invited",
      }),
      db.insert(schema.auditLog).values(
        buildAudit({
          organizationId: orgId,
          actorUserId: ctx.user.id,
          action: "account.portal_invited",
          entityType: "contact",
          entityId: contact.id,
          metadata: { email, role, contactName: contact.name },
        }),
      ),
    ]);
    const token = await createMagicToken({ userId, email });
    const url = new URL(`/api/auth/verify?token=${token}`, origin).toString();
    if (isDevAuth()) {
      inviteLinks[contact.id] = url;
      console.log(`[invite] ${email}: ${url}`);
    } else {
      try {
        await sendInviteEmail(email, url, org.name);
      } catch (err) {
        console.error("[invite] email send failed:", err);
      }
    }
    invited++;
  }
  return { invited, skipped, inviteLinks: Object.keys(inviteLinks).length ? inviteLinks : undefined };
}

// ---------------------------------------------------------------- archive (soft — replaces the cascade delete in the UI)

/**
 * Archive an account (frame 14b redesigned): hide from active lists, revoke portal
 * access (client users disabled), delete NOTHING. Admin-restorable. Admin only.
 */
export async function archiveOrganization(ctx: AuthContext, orgId: string): Promise<void> {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "archive_org", resource: `org:${orgId}`, reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can archive an account.");
  }
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Account not found.");
  await db.batch([
    db.update(schema.organizations).set({ status: "archived" }).where(eq(schema.organizations.id, orgId)),
    db
      .update(schema.users)
      .set({ status: "disabled" })
      .where(and(eq(schema.users.organizationId, orgId), eq(schema.users.userType, "client"))),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: orgId,
        actorUserId: ctx.user.id,
        action: "account.archived",
        entityType: "organization",
        entityId: orgId,
        metadata: { name: org.name },
      }),
    ),
  ]);
}

/**
 * Restore an archived account: client on any won deal, else prospect. Portal access
 * stays revoked (users disabled) until re-invited — deliberate. Admin only.
 */
export async function restoreOrganization(ctx: AuthContext, orgId: string): Promise<void> {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action: "restore_org", resource: `org:${orgId}`, reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can restore an account.");
  }
  const db = getDb();
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw new StageError("NOT_FOUND", "Account not found.");
  if (org.status !== "archived") return;
  const won = await db
    .select({ id: schema.deals.id })
    .from(schema.deals)
    .where(and(eq(schema.deals.organizationId, orgId), eq(schema.deals.stage, "won")));
  await db.batch([
    db.update(schema.organizations).set({ status: won.length > 0 ? "active" : "prospect" }).where(eq(schema.organizations.id, orgId)),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: orgId,
        actorUserId: ctx.user.id,
        action: "account.restored",
        entityType: "organization",
        entityId: orgId,
        metadata: { name: org.name },
      }),
    ),
  ]);
}

/**
 * Delete a client org and EVERYTHING under it — dev-only reset script, OUT of the
 * product UI since the archive redesign (the API now archives instead). Deletes in
 * FK-dependency order so the cascade never trips a constraint.
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
    // change_orders reference tasks + stages, so clear them first.
    db.delete(schema.changeOrders).where(eq(schema.changeOrders.organizationId, orgId)),
    db.delete(schema.taskAssignments).where(inArray(schema.taskAssignments.taskId, taskIds)),
    db.delete(schema.taskSubtasks).where(inArray(schema.taskSubtasks.taskId, taskIds)),
    db.delete(schema.taskNotes).where(inArray(schema.taskNotes.taskId, taskIds)),
    db.delete(schema.tasks).where(eq(schema.tasks.organizationId, orgId)),
    db.delete(schema.deliverableNotes).where(inArray(schema.deliverableNotes.stageLineItemId, lineItemIds)),
    db.delete(schema.stageLineItems).where(inArray(schema.stageLineItems.stageId, stageIds)),
    db.delete(schema.stages).where(eq(schema.stages.organizationId, orgId)),
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
