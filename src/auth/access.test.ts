import { describe, it, expect } from "vitest";
import { canAccessOrg, canAccessProject, canManageCommercialDeal, type AccessScope } from "@/auth/access";

const all: AccessScope = { kind: "all" };
const orgsA: AccessScope = { kind: "orgs", orgIds: ["A"] };
const noOrgs: AccessScope = { kind: "orgs", orgIds: [] };
const engP1: AccessScope = { kind: "projects", projectIds: ["p1"], orgIds: ["A"] };

describe("canAccessOrg", () => {
  it("admin (all) reaches any org", () => {
    expect(canAccessOrg(all, "A")).toBe(true);
    expect(canAccessOrg(all, "Z")).toBe(true);
  });
  it("org-scoped reaches only its orgs", () => {
    expect(canAccessOrg(orgsA, "A")).toBe(true);
    expect(canAccessOrg(orgsA, "B")).toBe(false);
  });
  it("empty scope reaches nothing", () => {
    expect(canAccessOrg(noOrgs, "A")).toBe(false);
  });
  it("project-scoped uses its orgIds for org-level checks", () => {
    expect(canAccessOrg(engP1, "A")).toBe(true);
    expect(canAccessOrg(engP1, "B")).toBe(false);
  });
});

describe("canAccessProject", () => {
  const inA = { id: "p1", organizationId: "A" };
  const otherInA = { id: "p2", organizationId: "A" };
  const inB = { id: "p9", organizationId: "B" };

  it("admin reaches any project", () => {
    expect(canAccessProject(all, inB)).toBe(true);
  });
  it("org-scoped reaches every project in their orgs, none outside", () => {
    expect(canAccessProject(orgsA, inA)).toBe(true);
    expect(canAccessProject(orgsA, otherInA)).toBe(true);
    expect(canAccessProject(orgsA, inB)).toBe(false);
  });
  it("project-scoped (engineer) reaches ONLY assigned projects — even within the same org", () => {
    expect(canAccessProject(engP1, inA)).toBe(true);
    expect(canAccessProject(engP1, otherInA)).toBe(false); // same org, NOT assigned
    expect(canAccessProject(engP1, inB)).toBe(false);
  });
  it("empty scope reaches no project", () => {
    expect(canAccessProject(noOrgs, inA)).toBe(false);
  });
});

describe("canManageCommercialDeal", () => {
  it("allows an admin with all-account scope", () => {
    expect(canManageCommercialDeal({ userId: "admin", role: "wahala_admin" }, all, { organizationId: "B", ownerUserId: "other" })).toBe(true);
  });

  it("allows a Sales / account owner only on an owned account", () => {
    const actor = { userId: "owner", role: "account_owner" };
    expect(canManageCommercialDeal(actor, orgsA, { organizationId: "A", ownerUserId: "other" })).toBe(true);
    expect(canManageCommercialDeal(actor, orgsA, { organizationId: "B", ownerUserId: "owner" })).toBe(false);
  });

  it("uses explicit deal ownership for an account-less opportunity", () => {
    const actor = { userId: "owner", role: "account_owner" };
    expect(canManageCommercialDeal(actor, noOrgs, { organizationId: null, ownerUserId: "owner" })).toBe(true);
    expect(canManageCommercialDeal(actor, noOrgs, { organizationId: null, ownerUserId: "other" })).toBe(false);
  });

  it("allows a sales rep only on a Deal explicitly assigned to them", () => {
    const actor = { userId: "rep", role: "sales_rep" };
    expect(canManageCommercialDeal(actor, engP1, { organizationId: "A", ownerUserId: "rep" })).toBe(true);
    expect(canManageCommercialDeal(actor, engP1, { organizationId: "A", ownerUserId: "other" })).toBe(false);
  });

  it("does not grant commercial writes to delivery roles", () => {
    expect(canManageCommercialDeal({ userId: "lead", role: "lead_engineer" }, orgsA, { organizationId: "A", ownerUserId: "lead" })).toBe(false);
  });
});
