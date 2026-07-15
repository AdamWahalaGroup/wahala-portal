/** Wahala-side roles an admin may assign when inviting a team member. */
export const INVITABLE_STAFF_ROLES = [
  "account_owner",
  "lead_engineer",
  "engineer",
  "wahala_admin",
] as const;

export type InvitableStaffRole = (typeof INVITABLE_STAFF_ROLES)[number];

export const STAFF_ROLE_META: Record<
  InvitableStaffRole,
  { label: string; description: string }
> = {
  account_owner: {
    label: "Sales / account owner",
    description: "Manages opportunities and commercial work for accounts assigned to them.",
  },
  lead_engineer: {
    label: "Lead engineer",
    description: "Leads assigned projects and controls delivery progress.",
  },
  engineer: {
    label: "Engineer",
    description: "Works only in projects where they are assigned.",
  },
  wahala_admin: {
    label: "Wahala admin",
    description: "Full access to every account, commercial control, settings, and team management.",
  },
};

export function isInvitableStaffRole(value: string): value is InvitableStaffRole {
  return INVITABLE_STAFF_ROLES.includes(value as InvitableStaffRole);
}
