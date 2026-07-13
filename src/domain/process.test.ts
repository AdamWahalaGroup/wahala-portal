import { describe, it, expect } from "vitest";
import { applyManualField, manualFieldStatusForSave, nextCallPrompts, readinessFrom, ASK_PROMPTS, DISCOVERY_SCRIPT_FIELDS, DISCOVERY_SCRIPT_GROUPS, PACKAGE_FIELDS, PACKAGE_FIELD_GUIDANCE, type PackageFields } from "./process";

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

describe("manualFieldStatusForSave", () => {
  it("treats an unclassified evidence save as complete", () => {
    expect(manualFieldStatusForSave(null)).toBe("ok");
  });

  it("preserves an explicit partial or missing classification", () => {
    expect(manualFieldStatusForSave("partial")).toBe("partial");
    expect(manualFieldStatusForSave("missing")).toBe("missing");
  });
});

describe("nextCallPrompts", () => {
  it("groups every package field exactly once in progressive call order", () => {
    expect(DISCOVERY_SCRIPT_FIELDS).toEqual([
      "business_profile",
      "decision_makers",
      "current_workflow",
      "pain_points",
      "customer_terminology",
      "success_metrics",
      "mvp_priorities",
      "deferred_scope",
      "budget_posture",
      "timeline",
    ]);
    expect(new Set(DISCOVERY_SCRIPT_FIELDS).size).toBe(PACKAGE_FIELDS.length);
    expect([...DISCOVERY_SCRIPT_FIELDS].sort()).toEqual([...PACKAGE_FIELDS].sort());
    expect(DISCOVERY_SCRIPT_GROUPS).toHaveLength(4);
  });

  it("has a non-empty prompt for all 10 fields", () => {
    for (const key of PACKAGE_FIELDS) {
      expect(ASK_PROMPTS[key].length).toBeGreaterThan(10);
      expect(PACKAGE_FIELD_GUIDANCE[key].meaning.length).toBeGreaterThan(30);
      expect(PACKAGE_FIELD_GUIDANCE[key].why.length).toBeGreaterThan(30);
    }
  });

  it("excludes ok fields and keeps progressive script order", () => {
    const fields = allOk();
    fields.pain_points = { status: "partial", evidence: null, source: null };
    fields.decision_makers = { status: "missing", evidence: null, source: null };
    const prompts = nextCallPrompts(fields);
    expect(prompts.map((p) => p.field)).toEqual(["decision_makers", "pain_points"]);
    expect(prompts[0].prompt).toBe(ASK_PROMPTS.decision_makers);
  });

  it("is empty at 10/10 and full for an empty package", () => {
    expect(nextCallPrompts(allOk())).toHaveLength(0);
    expect(nextCallPrompts({})).toHaveLength(10);
  });
});
