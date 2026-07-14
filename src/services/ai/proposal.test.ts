import { describe, expect, it } from "vitest";
import { buyingPathFrom, SOLUTION_CLARITY_FIELDS, type PackageFields } from "../../domain/process";
import { buildProposalEvidenceContext } from "./proposal";

describe("proposal evidence context", () => {
  it("includes every Discovery Package and Buying Path field", () => {
    const packageFields: PackageFields = {
      business_profile: { status: "ok", evidence: "Court-reporting agency", source: "manual" },
      pain_points: { status: "partial", evidence: "Turnaround is inconsistent", source: "call" },
      buyingPath: {
        economicBuyer: { status: "ok", evidence: "Jacob approves the purchase", source: "manual" },
        budget: { status: "partial", evidence: "Could use the technology budget", source: "call" },
      },
    };
    const buyingPath = buyingPathFrom({
      champion: null,
      economicBuyer: "Jacob approves the purchase",
      compellingEvent: null,
      decisionProcess: null,
      budgetStatus: "authority_known",
      budgetEvidence: "Could use the technology budget",
    }, packageFields.buyingPath);

    const context = buildProposalEvidenceContext({ packageFields, buyingPath });

    expect(context.discoveryPackage.fields).toHaveLength(SOLUTION_CLARITY_FIELDS.length);
    expect(context.discoveryPackage.readinessScore).toBe(1.9);
    expect(context.discoveryPackage.fields.map((field) => field.key)).toEqual(SOLUTION_CLARITY_FIELDS);
    expect(context.discoveryPackage.fields.find((field) => field.key === "business_profile")).toMatchObject({
      label: "Business profile",
      status: "ok",
      evidence: "Court-reporting agency",
      source: "manual",
    });
    expect(context.discoveryPackage.fields.find((field) => field.key === "current_workflow")).toMatchObject({
      status: "missing",
      evidence: null,
      source: null,
    });
    expect(context.buyingPath.fields).toHaveLength(5);
    expect(context.buyingPath.fields.find((field) => field.key === "economicBuyer")).toMatchObject({
      label: "Economic buyer",
      status: "ok",
      evidence: "Jacob approves the purchase",
    });
    expect(context.buyingPath.fundingMaturity).toEqual({
      value: "authority_known",
      label: "Possible funding source",
    });
    expect(context.buyingPath.overallStatus).toBe("developing");
  });
});
