import { describe, expect, it } from "vitest";
import { isInvitableStaffRole, STAFF_ROLE_META } from "@/domain/team";

describe("invitable staff roles", () => {
  it("accepts Wahala roles that an admin may invite", () => {
    expect(isInvitableStaffRole("account_owner")).toBe(true);
    expect(isInvitableStaffRole("lead_engineer")).toBe(true);
    expect(isInvitableStaffRole("engineer")).toBe(true);
    expect(isInvitableStaffRole("wahala_admin")).toBe(true);
  });

  it("rejects client roles and arbitrary values", () => {
    expect(isInvitableStaffRole("client_admin")).toBe(false);
    expect(isInvitableStaffRole("sales_rep")).toBe(false);
    expect(isInvitableStaffRole("")).toBe(false);
  });

  it("presents account owner as the non-admin commercial role", () => {
    expect(STAFF_ROLE_META.account_owner.label).toBe("Sales / account owner");
  });
});
