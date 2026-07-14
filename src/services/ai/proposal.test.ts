import { describe, expect, it } from "vitest";
import { buyingPathFrom, SOLUTION_CLARITY_FIELDS, type PackageFields } from "../../domain/process";
import type { ProposalScopeDetails } from "../../domain/proposal-doc";
import {
  buildProposalEvidenceContext,
  normalizeProposalProseOutput,
  splitProposalEvidenceItems,
  type ProposalEvidenceContext,
  type ProposalProseOutput,
  type ProposalShape,
} from "./proposal";

const scopeDetails: ProposalScopeDetails = {
  objective: "Deliver the reporter workflow.",
  scopeItems: ["Reporter portal"],
  deliverables: ["Reporter portal"],
  acceptanceCriteria: ["Reporter can sign in"],
  exclusions: [],
};

const evidenceContext: ProposalEvidenceContext = {
  discoveryPackage: {
    readinessScore: 10,
    fields: [{ key: "mvp_priorities", label: "MVP priorities", status: "ok", evidence: "Reporter portal", source: "manual" }],
  },
  buyingPath: {
    overallStatus: "developing",
    fundingMaturity: { value: "authority_known", label: "Possible funding source" },
    fields: [],
  },
};

const shapes: ProposalShape[] = [
  { label: "A", name: "Standard rollout", phased: false, phaseCount: 0, timelineNote: "one delivery" },
  { label: "B", name: "Phased buildout", phased: true, phaseCount: 1, timelineNote: "phased" },
];

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

describe("proposal prose normalization", () => {
  it("keeps a useful draft when the model uses option names as labels", () => {
    const output: ProposalProseOutput = {
      execSummary: "A grounded proposal.",
      options: [
        { label: "Complete reporter portal", name: "Complete reporter portal", summaryMd: "One delivery.", scopeDetails, phases: [] },
        {
          label: "Incremental reporter portal",
          name: "Incremental reporter portal",
          summaryMd: "A phased delivery.",
          scopeDetails,
          phases: [{ name: "Reporter foundation", scopeDetails }],
        },
      ],
      coverage: {
        items: [
          {
            priority: "Reporter portal",
            placements: [
              { optionLabel: "Complete reporter portal", disposition: "included", phaseName: null, note: "" },
              { optionLabel: "Incremental reporter portal", disposition: "included", phaseName: "Reporter foundation", note: "" },
            ],
          },
        ],
        warnings: [],
      },
    };

    const normalized = normalizeProposalProseOutput(output, shapes, evidenceContext);

    expect(normalized.options.map((option) => option.label)).toEqual(["A", "B"]);
    expect(normalized.coverage.items[0].placements).toEqual([
      { optionLabel: "A", disposition: "included", phaseName: null, note: "" },
      { optionLabel: "B", disposition: "included", phaseName: "Reporter foundation", note: "" },
    ]);
  });

  it("turns an invalid phase placement into a visible review question", () => {
    const output: ProposalProseOutput = {
      execSummary: "A grounded proposal.",
      options: [
        { label: "A", name: "Complete reporter portal", summaryMd: "One delivery.", scopeDetails, phases: [] },
        {
          label: "B",
          name: "Incremental reporter portal",
          summaryMd: "A phased delivery.",
          scopeDetails,
          phases: [{ name: "Reporter foundation", scopeDetails }],
        },
      ],
      coverage: {
        items: [
          {
            priority: "Reporter portal",
            placements: [
              { optionLabel: "A", disposition: "included", phaseName: null, note: "" },
              { optionLabel: "B", disposition: "included", phaseName: "Invented phase", note: "" },
            ],
          },
        ],
        warnings: [],
      },
    };

    const normalized = normalizeProposalProseOutput(output, shapes, evidenceContext);

    expect(normalized.coverage.items[0].placements[1]).toMatchObject({
      optionLabel: "B",
      disposition: "question",
      phaseName: null,
    });
    expect(normalized.coverage.warnings).toContain("Review “Reporter portal” for Option B; its included phase could not be matched.");
  });
});

describe("proposal fallback item splitting", () => {
  it("turns sentences and bullets into distinct editable items", () => {
    expect(
      splitProposalEvidenceItems("Portal with RBAC. Text to speech from audio upload.\n- Reporter can flag a rough draft; Client can review it"),
    ).toEqual(["Portal with RBAC", "Text to speech from audio upload", "Reporter can flag a rough draft", "Client can review it"]);
  });
});
