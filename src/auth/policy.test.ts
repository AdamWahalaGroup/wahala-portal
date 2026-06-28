import { describe, it, expect } from "vitest";
import { canActOnStage, type PolicyActor, type StageResource } from "@/auth/policy";

const resource: StageResource = {
  organizationId: "org1",
  projectLeadUserId: "lead1",
  accountOwnerUserId: "owner1",
};

const actor = (over: Partial<PolicyActor>): PolicyActor => ({
  userId: "u",
  userType: "wahala",
  role: "engineer",
  organizationId: null,
  isAdmin: false,
  ...over,
});

const admin = actor({ userId: "a", role: "wahala_admin", isAdmin: true });
const owner = actor({ userId: "owner1", role: "account_owner" });
const ownerOther = actor({ userId: "ownerX", role: "account_owner" });
const lead = actor({ userId: "lead1", role: "lead_engineer" });
const leadOther = actor({ userId: "leadX", role: "lead_engineer" });
const engineer = actor({ userId: "e", role: "engineer" });
const clientAdmin = actor({ userId: "c1", userType: "client", role: "client_admin", organizationId: "org1" });
const clientOtherOrg = actor({ userId: "c2", userType: "client", role: "client_admin", organizationId: "org2" });
const clientReadonly = actor({ userId: "c3", userType: "client", role: "client_readonly", organizationId: "org1" });

const ok = (d: ReturnType<typeof canActOnStage>) => d.allowed === true;

describe("quoting + threshold co-sign", () => {
  it("the account owner can send a quote under threshold", () => {
    expect(ok(canActOnStage(owner, "send_quote", resource))).toBe(true);
  });

  it("a non-owner account_owner cannot quote this org's stage", () => {
    expect(ok(canActOnStage(ownerOther, "send_quote", resource))).toBe(false);
  });

  it("over threshold, only a Wahala admin may send the quote", () => {
    expect(ok(canActOnStage(owner, "send_quote", resource, { overThreshold: true }))).toBe(false);
    expect(ok(canActOnStage(admin, "send_quote", resource, { overThreshold: true }))).toBe(true);
  });
});

describe("delivery side", () => {
  it("the project lead can start/deliver; a different lead cannot", () => {
    expect(ok(canActOnStage(lead, "start_work", resource))).toBe(true);
    expect(ok(canActOnStage(lead, "deliver", resource))).toBe(true);
    expect(ok(canActOnStage(leadOther, "deliver", resource))).toBe(false);
  });

  it("a plain engineer cannot drive stage transitions", () => {
    expect(ok(canActOnStage(engineer, "deliver", resource))).toBe(false);
    expect(ok(canActOnStage(engineer, "start_work", resource))).toBe(false);
  });

  it("an admin bypasses lead/owner scoping", () => {
    expect(ok(canActOnStage(admin, "deliver", resource))).toBe(true);
    expect(ok(canActOnStage(admin, "send_quote", resource))).toBe(true);
  });
});

describe("client side + tenant isolation", () => {
  it("a same-org client admin can approve and accept", () => {
    expect(ok(canActOnStage(clientAdmin, "approve_quote", resource))).toBe(true);
    expect(ok(canActOnStage(clientAdmin, "accept", resource))).toBe(true);
  });

  it("a client from another org is denied (cross-tenant)", () => {
    expect(ok(canActOnStage(clientOtherOrg, "approve_quote", resource))).toBe(false);
    expect(ok(canActOnStage(clientOtherOrg, "accept", resource))).toBe(false);
  });

  it("a read-only client cannot mutate", () => {
    expect(ok(canActOnStage(clientReadonly, "approve_quote", resource))).toBe(false);
    expect(ok(canActOnStage(clientReadonly, "accept", resource))).toBe(false);
  });

  it("clients cannot perform staff (delivery) actions", () => {
    expect(ok(canActOnStage(clientAdmin, "start_work", resource))).toBe(false);
    expect(ok(canActOnStage(clientAdmin, "deliver", resource))).toBe(false);
  });

  it("staff cannot perform client acceptance", () => {
    expect(ok(canActOnStage(admin, "accept", resource))).toBe(false);
    expect(ok(canActOnStage(lead, "approve_quote", resource))).toBe(false);
  });
});
