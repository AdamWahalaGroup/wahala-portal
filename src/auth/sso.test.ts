import { describe, it, expect } from "vitest";
import { resolveSsoOutcome, isSsoProvider } from "@/auth/sso";

describe("isSsoProvider", () => {
  it("accepts google, rejects others", () => {
    expect(isSsoProvider("google")).toBe(true);
    expect(isSsoProvider("github")).toBe(false);
    expect(isSsoProvider("")).toBe(false);
  });
});

describe("resolveSsoOutcome", () => {
  it("denies an unverified email regardless of account/domain", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "active" }, false)).toEqual({
      ok: false,
      reason: "unverified_email",
    });
  });

  it("logs in an existing active account (no re-activation)", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "active" }, true)).toEqual({
      ok: true,
      kind: "login",
      userId: "u1",
      activate: false,
    });
  });

  it("logs in an invited account and flags activation (= accepted)", () => {
    expect(resolveSsoOutcome({ id: "u2", status: "invited" }, true)).toEqual({
      ok: true,
      kind: "login",
      userId: "u2",
      activate: true,
    });
  });

  it("denies a disabled account", () => {
    expect(resolveSsoOutcome({ id: "u1", status: "disabled" }, true)).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("denies every unknown email because staff and clients are invite-only", () => {
    expect(resolveSsoOutcome(null, true)).toEqual({ ok: false, reason: "no_account" });
  });
});
