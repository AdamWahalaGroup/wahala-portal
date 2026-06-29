import { describe, it, expect } from "vitest";
import { resolveSsoOutcome, isSsoProvider } from "@/auth/sso";

describe("isSsoProvider", () => {
  it("accepts google, rejects others", () => {
    expect(isSsoProvider("google")).toBe(true);
    expect(isSsoProvider("github")).toBe(false);
    expect(isSsoProvider("")).toBe(false);
  });
});

describe("resolveSsoOutcome (invite-only, email-matched)", () => {
  it("denies an unverified email regardless of account", () => {
    const r = resolveSsoOutcome({ id: "u1", status: "active" }, false);
    expect(r).toEqual({ ok: false, reason: "unverified_email" });
  });

  it("denies an unknown email (no auto-provisioning)", () => {
    expect(resolveSsoOutcome(null, true)).toEqual({ ok: false, reason: "no_account" });
  });

  it("denies a disabled account", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "disabled" }, true)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("allows an active account without re-activating", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "active" }, true)).toEqual({
      ok: true,
      userId: "u1",
      activate: false,
    });
  });

  it("allows an invited account and flags it for activation", () => {
    expect(resolveSsoOutcome({ id: "u2", status: "invited" }, true)).toEqual({
      ok: true,
      userId: "u2",
      activate: true,
    });
  });
});
