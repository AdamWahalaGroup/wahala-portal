import { describe, it, expect } from "vitest";
import { applyManualField, nextCallPrompts, readinessFrom, ASK_PROMPTS, type PackageFields } from "./process";
import { PACKAGE_FIELDS } from "../db/schema";

const allOk = (): PackageFields =>
  Object.fromEntries(PACKAGE_FIELDS.map((k) => [k, { status: "ok", evidence: "e", source: "call" }])) as PackageFields;

describe("applyManualField", () => {
  it("upgrades missing → ok and bumps readiness by 1.0", () => {
    const fields: PackageFields = {};
    const { fields: next, readiness } = applyManualField(fields, "budget_posture", { status: "ok", evidence: "  $40–60k confirmed  " });
    expect(readiness).toBe(1);
    expect(next.budget_posture).toEqual({ status: "ok", evidence: "$40–60k confirmed", source: "manual" });
    expect(fields.budget_posture).toBeUndefined(); // non-mutating
  });

  it("allows a human to DOWNGRADE (unlike the AI merge)", () => {
    const { fields: next, readiness } = applyManualField(allOk(), "decision_makers", { status: "missing" });
    expect(next.decision_makers?.status).toBe("missing");
    expect(readiness).toBe(9);
  });

  it("nulls empty evidence and always sets source manual", () => {
    const { fields: next } = applyManualField({}, "timeline", { status: "partial", evidence: "   " });
    expect(next.timeline).toEqual({ status: "partial", evidence: null, source: "manual" });
    expect(readinessFrom(next)).toBe(0.5);
  });
});

describe("nextCallPrompts", () => {
  it("has a non-empty prompt for all 10 fields", () => {
    for (const key of PACKAGE_FIELDS) expect(ASK_PROMPTS[key].length).toBeGreaterThan(10);
  });

  it("excludes ok fields and keeps PACKAGE_FIELDS order", () => {
    const fields = allOk();
    fields.pain_points = { status: "partial", evidence: null, source: null };
    fields.decision_makers = { status: "missing", evidence: null, source: null };
    const prompts = nextCallPrompts(fields);
    expect(prompts.map((p) => p.field)).toEqual(["pain_points", "decision_makers"]);
    expect(prompts[1].prompt).toBe(ASK_PROMPTS.decision_makers);
  });

  it("is empty at 10/10 and full for an empty package", () => {
    expect(nextCallPrompts(allOk())).toHaveLength(0);
    expect(nextCallPrompts({})).toHaveLength(10);
  });
});
