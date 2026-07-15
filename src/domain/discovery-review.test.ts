import { describe, expect, it } from "vitest";
import { PACKAGE_FIELDS, type PackageFields } from "./process";
import {
  DISCOVERY_REVIEW_STATUSES,
  mergeReviewedPackage,
  normalizeDiscoveryAnalysis,
  recommendedDiscoverySelection,
  sanitizeDiscoverySelection,
  type DiscoveryAnalysis,
} from "./discovery-review";

const missingFields = Object.fromEntries(
  PACKAGE_FIELDS.map((key) => [key, { status: "missing", evidence: "", source: "" }]),
) as DiscoveryAnalysis["packageFields"];

function analysis(): DiscoveryAnalysis {
  return {
    discoveryMd: "# Discovery",
    packageFields: {
      ...missingFields,
      pain_points: { status: "ok", evidence: "Manual review is slow", source: "call — 00:08" },
    },
    fieldsImproved: 1,
    qualification: {
      champion: { suggested: true, value: "Jamie", evidence: "Jamie is driving this", source: "call — 00:12" },
      economicBuyer: { suggested: false, value: "", evidence: "", source: "" },
      compellingEvent: { suggested: false, value: "", evidence: "", source: "" },
      decisionProcess: { suggested: false, value: "", evidence: "", source: "" },
      budgetStatus: { suggested: true, value: "funding_path", evidence: "Finance review next week", source: "call — 00:14" },
      budgetEvidence: { suggested: true, value: "Finance review next week", evidence: "Finance review next week", source: "call — 00:14" },
    },
    commercial: {
      engagementType: { suggested: true, value: "custom_build", evidence: "Build a new app", source: "call — 00:03" },
      deliveryModel: { suggested: false, value: "", evidence: "", source: "" },
      ipDisposition: { suggested: false, value: "", evidence: "", source: "" },
      dataSensitivity: { suggested: true, value: "high_risk", evidence: "Deposition audio", source: "call — 00:04" },
      supportExpectation: { suggested: false, value: "", evidence: "", source: "" },
    },
    followUp: {
      suggested: true,
      action: "Jamie will send the sample files",
      dueAt: "2026-07-17",
      court: "client",
      evidence: "Jamie agreed to send the files Friday",
      source: "call — 00:18",
    },
  };
}

describe("discovery review", () => {
  it("distinguishes a saved call from one with pending AI evidence", () => {
    expect(DISCOVERY_REVIEW_STATUSES).toContain("not_analyzed");
    expect(DISCOVERY_REVIEW_STATUSES).toContain("pending");
  });

  it("recommends evidence improvements but never preselects commercial decisions", () => {
    const recommended = recommendedDiscoverySelection(
      { champion: null, economicBuyer: null, compellingEvent: null, decisionProcess: null, budgetStatus: "unknown", budgetEvidence: null },
      {},
      analysis(),
    );
    expect(recommended.packageFields).toEqual(["pain_points"]);
    expect(recommended.qualificationFields).toEqual(["champion", "budgetStatus", "budgetEvidence"]);
    expect(recommended.commercialFields).toEqual([]);
    expect(recommended.applyFollowUp).toBe(false);
  });

  it("does not recommend overwriting existing human qualification", () => {
    const recommended = recommendedDiscoverySelection(
      { champion: "Existing", economicBuyer: null, compellingEvent: null, decisionProcess: null, budgetStatus: "confirmed", budgetEvidence: "Approved PO" },
      {},
      analysis(),
    );
    expect(recommended.qualificationFields).toEqual([]);
  });

  it("applies only selected package evidence and recomputes readiness", () => {
    const current: PackageFields = { business_profile: { status: "ok", evidence: "Agency", source: "manual" } };
    const result = mergeReviewedPackage(current, analysis().packageFields, ["pain_points"]);
    expect(result.fields.pain_points?.evidence).toBe("Manual review is slow");
    expect(result.fields.business_profile?.status).toBe("ok");
    expect(result.fieldsImproved).toBe(1);
    expect(result.readiness).toBe(2.5);
  });

  it("never lets an AI review downgrade accepted readiness evidence", () => {
    const current: PackageFields = { pain_points: { status: "ok", evidence: "Confirmed manually", source: "manual" } };
    const proposed = analysis().packageFields;
    proposed.pain_points = { status: "partial", evidence: "Less certain", source: "new call" };
    const result = mergeReviewedPackage(current, proposed, ["pain_points"]);
    expect(result.fields.pain_points).toEqual(current.pain_points);
    expect(result.readiness).toBe(1.3);
  });

  it("drops unknown or duplicate selection keys", () => {
    const clean = sanitizeDiscoverySelection({
      applyDiscoveryMd: true,
      packageFields: ["pain_points", "pain_points", "invalid" as never],
      qualificationFields: ["champion", "invalid" as never],
      commercialFields: ["dataSensitivity", "invalid" as never],
      applyFollowUp: true,
    });
    expect(clean.packageFields).toEqual(["pain_points"]);
    expect(clean.qualificationFields).toEqual(["champion"]);
    expect(clean.commercialFields).toEqual(["dataSensitivity"]);
    expect(clean.applyFollowUp).toBe(true);
  });

  it("treats malformed API selections as empty instead of throwing", () => {
    expect(sanitizeDiscoverySelection({ applyDiscoveryMd: "yes", packageFields: null })).toEqual({
      applyDiscoveryMd: false,
      packageFields: [],
      qualificationFields: [],
      commercialFields: [],
      applyFollowUp: false,
    });
  });

  it("normalizes reviews stored before follow-up extraction existed", () => {
    const older = analysis();
    delete (older as Partial<DiscoveryAnalysis>).followUp;
    expect(normalizeDiscoveryAnalysis(older).followUp).toEqual({
      suggested: false,
      action: "",
      dueAt: "",
      court: "",
      evidence: "",
      source: "",
    });
  });
});
