import { describe, it, expect } from "vitest";
import { canAccessOrg, canAccessProject, type AccessScope } from "@/auth/access";

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
