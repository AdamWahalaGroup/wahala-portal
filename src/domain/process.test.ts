import { describe, it, expect } from "vitest";
import { applyManualField, buyingPathFrom, goalFor, manualFieldStatusForSave, nextBestActions, nextCallPrompts, packageStatusForBudget, proposalReadinessFrom, readinessFrom, ASK_PROMPTS, DISCOVERY_SCRIPT_FIELDS, DISCOVERY_SCRIPT_GROUPS, PACKAGE_FIELDS, PACKAGE_FIELD_GUIDANCE, SOLUTION_CLARITY_FIELDS, type PackageFields } from "./process";

const allOk = (): PackageFields =>
  Object.fromEntries(PACKAGE_FIELDS.map((k) => [k, { status: "ok", evidence: "e", source: "call" }])) as PackageFields;

describe("applyManualField", () => {
  it("upgrades a solution field and recomputes clarity across eight fields", () => {
    const fields: PackageFields = {};
    const { fields: next, readiness } = applyManualField(fields, "current_workflow", { status: "ok", evidence: "  Manual intake  " });
    expect(readiness).toBe(1.3);
    expect(next.current_workflow).toEqual({ status: "ok", evidence: "Manual intake", source: "manual" });
    expect(fields.current_workflow).toBeUndefined(); // non-mutating
  });

  it("allows a human to DOWNGRADE (unlike the AI merge)", () => {
    const { fields: next, readiness } = applyManualField(allOk(), "pain_points", { status: "missing" });
    expect(next.pain_points?.status).toBe("missing");
    expect(readiness).toBe(8.8);
  });

  it("nulls empty evidence and always sets source manual", () => {
    const { fields: next } = applyManualField({}, "timeline", { status: "partial", evidence: "   " });
    expect(next.timeline).toEqual({ status: "partial", evidence: null, source: "manual" });
    expect(readinessFrom(next)).toBe(0.6);
  });

  it("does not let legacy buyer fields inflate solution clarity", () => {
    const fields: PackageFields = {
      decision_makers: { status: "ok", evidence: "CEO", source: "old review" },
      budget_posture: { status: "ok", evidence: "$50k", source: "old review" },
    };
    expect(readinessFrom(fields)).toBe(0);
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

describe("packageStatusForBudget", () => {
  it("derives one evidence classification from funding maturity", () => {
    expect(packageStatusForBudget("unknown")).toBe("missing");
    expect(packageStatusForBudget("authority_known")).toBe("partial");
    expect(packageStatusForBudget("funding_path")).toBe("ok");
    expect(packageStatusForBudget("confirmed")).toBe("ok");
  });
});

describe("nextCallPrompts", () => {
  it("groups every package field exactly once in progressive call order", () => {
    expect(DISCOVERY_SCRIPT_FIELDS).toEqual([
      "business_profile",
      "current_workflow",
      "pain_points",
      "customer_terminology",
      "success_metrics",
      "mvp_priorities",
      "deferred_scope",
      "timeline",
    ]);
    expect(new Set(DISCOVERY_SCRIPT_FIELDS).size).toBe(SOLUTION_CLARITY_FIELDS.length);
    expect([...DISCOVERY_SCRIPT_FIELDS].sort()).toEqual([...SOLUTION_CLARITY_FIELDS].sort());
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
    fields.timeline = { status: "missing", evidence: null, source: null };
    const prompts = nextCallPrompts(fields);
    expect(prompts.map((p) => p.field)).toEqual(["pain_points", "timeline"]);
    expect(prompts[0].prompt).toBe(ASK_PROMPTS.pain_points);
  });

  it("is empty at 10/10 and full for an empty package", () => {
    expect(nextCallPrompts(allOk())).toHaveLength(0);
    expect(nextCallPrompts({})).toHaveLength(8);
  });
});

describe("buyingPathFrom", () => {
  it("keeps an empty buying path explicitly unverified", () => {
    const path = buyingPathFrom({ champion: null, economicBuyer: null, compellingEvent: null, decisionProcess: null, budgetStatus: "unknown", budgetEvidence: null });
    expect(path.status).toBe("unverified");
    expect(path.completed).toBe(0);
  });

  it("requires all five signals and an identified funding path for confirmation", () => {
    const base = { champion: "Jamie", economicBuyer: "Morgan", compellingEvent: "Renewal in September", decisionProcess: "CEO then legal", budgetEvidence: "Approved $50k" };
    expect(buyingPathFrom({ ...base, budgetStatus: "authority_known" }).status).toBe("developing");
    expect(buyingPathFrom({ ...base, budgetStatus: "funding_path" }).status).toBe("confirmed");
    expect(buyingPathFrom({ ...base, budgetStatus: "confirmed" }).status).toBe("confirmed");
  });

  it("honors explicit OK, Partial, and Missing classifications", () => {
    const input = { champion: "Jamie", economicBuyer: "Morgan", compellingEvent: "Renewal", decisionProcess: "CEO then legal", budgetStatus: "confirmed" as const, budgetEvidence: "Approved" };
    const path = buyingPathFrom(input, {
      champion: { status: "partial", evidence: "Jamie likes it but has not agreed to sponsor it", source: "manual" },
      economicBuyer: { status: "missing", evidence: "CEO is suspected but unconfirmed", source: "manual" },
    });
    expect(path.status).toBe("developing");
    expect(path.completed).toBe(3);
    expect(path.missing).toEqual(["champion", "economicBuyer"]);
    expect(path.fields.champion?.status).toBe("partial");
  });
});

describe("discovery guidance", () => {
  it("keeps draft and send readiness as separate milestones", () => {
    expect(proposalReadinessFrom(6.9, "confirmed")).toEqual({ readyToDraft: false, readyToSend: false });
    expect(proposalReadinessFrom(7, "developing")).toEqual({ readyToDraft: true, readyToSend: false });
    expect(proposalReadinessFrom(7, "confirmed")).toEqual({ readyToDraft: true, readyToSend: true });
  });

  it("allows drafting at sufficient solution clarity while naming the open buying path", () => {
    expect(goalFor("discovery", 10, 2, "developing")).toContain("sufficient to draft");
    expect(goalFor("discovery", 10, 2, "developing")).toContain("before sending");

    const actions = nextBestActions({
      stage: "discovery",
      readiness: 10,
      hasDiscoveryMd: true,
      proposalStatus: "draft",
      complexityScore: 2,
      depositPaid: false,
      buyingPathStatus: "developing",
    });
    expect(actions.some((action) => action.active && action.text.includes("Confirm the buying path"))).toBe(true);
    expect(actions.some((action) => action.active && action.text.startsWith("Set the price"))).toBe(false);
  });

  it("moves guidance to proposal preparation when both signals are established", () => {
    expect(goalFor("discovery", 8, 2, "confirmed")).toContain("draft and prepare the proposal");
  });
});
