import { asc, eq } from "drizzle-orm";
import type { AuthContext } from "@/auth/context";
import { sendStaffInviteEmail } from "@/auth/email";
import { createMagicToken } from "@/auth/magic-link";
import { isDevAuth } from "@/auth/server-env";
import { getDb, schema } from "@/db";
import {
  isInvitableStaffRole,
  STAFF_ROLE_META,
  type InvitableStaffRole,
} from "@/domain/team";
import { StageError } from "@/domain/stage-machine";
import { securityLog } from "@/lib/security-log";
import { buildAudit } from "@/services/audit";

export type TeamMemberView = {
  id: string;
  name: string;
  email: string;
  role: InvitableStaffRole;
  roleLabel: string;
  status: "invited" | "active" | "disabled";
  trainingMode: boolean;
  createdAt: string;
};

function assertAdmin(ctx: AuthContext, action: string): void {
  if (!ctx.isAdmin) {
    securityLog({ actorUserId: ctx.user.id, role: ctx.user.role, action, reason: "not_admin" });
    throw new StageError("FORBIDDEN", "Only a Wahala admin can manage team access.");
  }
}

function memberView(row: typeof schema.users.$inferSelect): TeamMemberView {
  // Only Wahala users with an invitable staff role are loaded by this service.
  const role = row.role as InvitableStaffRole;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    roleLabel: STAFF_ROLE_META[role].label,
    status: row.status,
    trainingMode: row.trainingMode,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTeamMembers(ctx: AuthContext): Promise<TeamMemberView[]> {
  assertAdmin(ctx, "list_team_members");
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.userType, "wahala"))
    .orderBy(asc(schema.users.name));
  return rows.filter((row) => isInvitableStaffRole(row.role)).map(memberView);
}

export async function inviteTeamMember(
  ctx: AuthContext,
  input: { name?: string; email?: string; role?: string; trainingMode?: boolean },
  origin: string,
): Promise<{
  member: TeamMemberView;
  emailDelivery: "sent" | "failed" | "development_link";
  inviteLink?: string;
}> {
  assertAdmin(ctx, "invite_team_member");

  const name = input.name?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const role = input.role?.trim() ?? "";
  if (!name) throw new StageError("VALIDATION", "Name is required.");
  if (name.length > 120) throw new StageError("VALIDATION", "Name must be 120 characters or fewer.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new StageError("VALIDATION", "Enter a valid email address.");
  }
  if (!isInvitableStaffRole(role)) throw new StageError("VALIDATION", "Choose a valid Wahala role.");

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) throw new StageError("VALIDATION", "A portal user with that email already exists.");

  const id = crypto.randomUUID();
  const trainingMode = input.trainingMode === true;
  await db.batch([
    db.insert(schema.users).values({
      id,
      organizationId: null,
      userType: "wahala",
      role,
      name,
      email,
      status: "invited",
      trainingMode,
    }),
    db.insert(schema.auditLog).values(
      buildAudit({
        organizationId: null,
        actorUserId: ctx.user.id,
        action: "team.member_invited",
        entityType: "user",
        entityId: id,
        metadata: { email, role, trainingMode },
      }),
    ),
  ]);

  const token = await createMagicToken({ userId: id, email });
  const url = new URL(`/api/auth/verify?token=${token}`, origin).toString();
  let emailDelivery: "sent" | "failed" | "development_link" = "sent";
  let inviteLink: string | undefined;

  if (isDevAuth()) {
    emailDelivery = "development_link";
    inviteLink = url;
    console.log(`[staff invite] ${email}: ${url}`);
  } else {
    try {
      await sendStaffInviteEmail(email, url, STAFF_ROLE_META[role].label);
    } catch (error) {
      emailDelivery = "failed";
      console.error("[staff invite] email delivery failed", error);
    }
  }

  const created = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!created) throw new StageError("INVALID_STATE", "The member was created but could not be reloaded.");
  return { member: memberView(created), emailDelivery, inviteLink };
}
