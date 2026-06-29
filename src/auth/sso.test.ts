import { describe, it, expect } from "vitest";
import { resolveSsoOutcome, isSsoProvider, emailDomain } from "@/auth/sso";

const CLIENT = { isStaffDomain: false };
const STAFF = { isStaffDomain: true };

describe("isSsoProvider", () => {
  it("accepts google, rejects others", () => {
    expect(isSsoProvider("google")).toBe(true);
    expect(isSsoProvider("github")).toBe(false);
    expect(isSsoProvider("")).toBe(false);
  });
});

describe("emailDomain", () => {
  it("extracts the lower-cased domain", () => {
    expect(emailDomain("Ada@Wahalagroup.com")).toBe("wahalagroup.com");
    expect(emailDomain("nope")).toBe("");
  });
});

describe("resolveSsoOutcome", () => {
  it("denies an unverified email regardless of account/domain", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "active" }, false, STAFF)).toEqual({
      ok: false,
      reason: "unverified_email",
    });
  });

  it("logs in an existing active account (no re-activation)", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "active" }, true, CLIENT)).toEqual({
      ok: true,
      kind: "login",
      userId: "u1",
      activate: false,
    });
  });

  it("logs in an invited account and flags activation (= accepted)", () => {
    expect(resolveSsoOutcome({ id: "u2", status: "invited" }, true, CLIENT)).toEqual({
      ok: true,
      kind: "login",
      userId: "u2",
      activate: true,
    });
  });

  it("denies a disabled account", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "disabled" }, true, STAFF)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("auto-provisions a Wahala admin for an unknown STAFF-domain email", () => {
    expect(resolveSsoOutcome(null, true, STAFF)).toEqual({ ok: true, kind: "provision_staff" });
  });

  it("denies an unknown NON-staff email (clients are invite-only)", () => {
    expect(resolveSsoOutcome(null, true, CLIENT)).toEqual({ ok: false, reason: "no_account" });
  });
});
