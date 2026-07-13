import {
  BUDGET_STATUSES,
  DATA_SENSITIVITIES,
  DELIVERY_MODELS,
  ENGAGEMENT_TYPES,
  IP_DISPOSITIONS,
  NEXT_ACTION_COURTS,
  type BudgetStatus,
  type DataSensitivity,
  type DeliveryModel,
  type EngagementType,
  type IpDisposition,
  type NextActionCourt,
} from "./deal-operating-model";
import {
  PACKAGE_FIELDS,
  readinessFrom,
  type PackageField,
  type PackageFieldKey,
  type PackageFields,
} from "./process";

export const DISCOVERY_REVIEW_STATUSES = ["pending", "applied", "dismissed"] as const;
export type DiscoveryReviewStatus = (typeof DISCOVERY_REVIEW_STATUSES)[number];

export const QUALIFICATION_REVIEW_FIELDS = [
  "champion",
  "economicBuyer",
  "compellingEvent",
  "decisionProcess",
  "budgetStatus",
  "budgetEvidence",
] as const;
export type QualificationReviewField = (typeof QUALIFICATION_REVIEW_FIELDS)[number];

export const COMMERCIAL_REVIEW_FIELDS = [
  "engagementType",
  "deliveryModel",
  "ipDisposition",
  "dataSensitivity",
  "supportExpectation",
] as const;
export type CommercialReviewField = (typeof COMMERCIAL_REVIEW_FIELDS)[number];

export type EvidenceSuggestion<T extends string = string> = {
  suggested: boolean;
  value: T;
  evidence: string;
  source: string;
};

export type DiscoveryAnalysis = {
  discoveryMd: string;
  packageFields: Record<PackageFieldKey, PackageField>;
  fieldsImproved: number;
  qualification: {
    champion: EvidenceSuggestion;
    economicBuyer: EvidenceSuggestion;
    compellingEvent: EvidenceSuggestion;
    decisionProcess: EvidenceSuggestion;
    budgetStatus: EvidenceSuggestion<"" | BudgetStatus>;
    budgetEvidence: EvidenceSuggestion;
  };
  commercial: {
    engagementType: EvidenceSuggestion<"" | EngagementType>;
    deliveryModel: EvidenceSuggestion<"" | DeliveryModel>;
    ipDisposition: EvidenceSuggestion<"" | IpDisposition>;
    dataSensitivity: EvidenceSuggestion<"" | DataSensitivity>;
    supportExpectation: EvidenceSuggestion;
  };
  followUp: {
    suggested: boolean;
    action: string;
    dueAt: string;
    court: "" | NextActionCourt;
    evidence: string;
    source: string;
  };
};

export type DiscoveryReviewSelection = {
  applyDiscoveryMd: boolean;
  packageFields: PackageFieldKey[];
  qualificationFields: QualificationReviewField[];
  commercialFields: CommercialReviewField[];
  applyFollowUp: boolean;
};

export type DiscoveryReviewRecommendation = DiscoveryReviewSelection;

export const QUALIFICATION_REVIEW_LABELS: Record<QualificationReviewField, string> = {
  champion: "Champion",
  economicBuyer: "Economic buyer",
  compellingEvent: "Compelling event",
  decisionProcess: "Decision process",
  budgetStatus: "Budget status",
  budgetEvidence: "Budget evidence",
};

export const COMMERCIAL_REVIEW_LABELS: Record<CommercialReviewField, string> = {
  engagementType: "Engagement type",
  deliveryModel: "Delivery model",
  ipDisposition: "IP disposition",
  dataSensitivity: "Data sensitivity",
  supportExpectation: "Support expectation",
};

export function isQualificationReviewField(value: string): value is QualificationReviewField {
  return (QUALIFICATION_REVIEW_FIELDS as readonly string[]).includes(value);
}

export function isCommercialReviewField(value: string): value is CommercialReviewField {
  return (COMMERCIAL_REVIEW_FIELDS as readonly string[]).includes(value);
}

export function isPackageFieldKey(value: string): value is PackageFieldKey {
  return (PACKAGE_FIELDS as readonly string[]).includes(value);
}

export function sanitizeDiscoverySelection(input: unknown): DiscoveryReviewSelection {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const packageFields = Array.isArray(record.packageFields) ? record.packageFields.filter((value): value is string => typeof value === "string") : [];
  const qualificationFields = Array.isArray(record.qualificationFields) ? record.qualificationFields.filter((value): value is string => typeof value === "string") : [];
  const commercialFields = Array.isArray(record.commercialFields) ? record.commercialFields.filter((value): value is string => typeof value === "string") : [];
  return {
    applyDiscoveryMd: record.applyDiscoveryMd === true,
    packageFields: [...new Set(packageFields.filter(isPackageFieldKey))],
    qualificationFields: [...new Set(qualificationFields.filter(isQualificationReviewField))],
    commercialFields: [...new Set(commercialFields.filter(isCommercialReviewField))],
    applyFollowUp: record.applyFollowUp === true,
  };
}

/** Stored reviews created before follow-up extraction remain reviewable. */
export function normalizeDiscoveryAnalysis(analysis: DiscoveryAnalysis): DiscoveryAnalysis {
  return {
    ...analysis,
    followUp: analysis.followUp ?? {
      suggested: false,
      action: "",
      dueAt: "",
      court: "",
      evidence: "",
      source: "",
    },
  };
}

const rank = { missing: 0, partial: 1, ok: 2 } as const;

export function mergeReviewedPackage(
  current: PackageFields,
  proposed: Record<PackageFieldKey, PackageField>,
  selected: PackageFieldKey[],
): { fields: PackageFields; readiness: number; fieldsImproved: number } {
  const fields: PackageFields = { ...current };
  let fieldsImproved = 0;
  for (const key of selected) {
    const next = proposed[key];
    const before = current[key]?.status ?? "missing";
    // AI is allowed to add or refresh evidence, but not to reduce readiness.
    // A deliberate human downgrade remains available through the manual editor.
    if (rank[next.status] < rank[before]) continue;
    fields[key] = {
      status: next.status,
      evidence: next.evidence?.trim() || null,
      source: next.source?.trim() || null,
    };
    if (rank[next.status] > rank[before]) fieldsImproved += 1;
  }
  return { fields, readiness: readinessFrom(fields), fieldsImproved };
}

export function recommendedDiscoverySelection(
  current: {
    champion: string | null;
    economicBuyer: string | null;
    compellingEvent: string | null;
    decisionProcess: string | null;
    budgetStatus: BudgetStatus;
    budgetEvidence: string | null;
  },
  packageFields: PackageFields,
  analysis: DiscoveryAnalysis,
): DiscoveryReviewRecommendation {
  const packageSelection = PACKAGE_FIELDS.filter((key) => {
    const before = packageFields[key]?.status ?? "missing";
    return rank[analysis.packageFields[key].status] > rank[before];
  });
  const qualificationFields = QUALIFICATION_REVIEW_FIELDS.filter((key) => {
    const suggestion = analysis.qualification[key];
    if (!suggestion.suggested || !suggestion.value.trim()) return false;
    if (key === "budgetStatus") return current.budgetStatus === "unknown" && suggestion.value !== "unknown";
    return !current[key];
  });
  return {
    applyDiscoveryMd: !!analysis.discoveryMd.trim(),
    packageFields: packageSelection,
    qualificationFields,
    // Commercial/legal decisions always require an affirmative opt-in.
    commercialFields: [],
    // Commitments affect the Deal's operating cadence and always require confirmation.
    applyFollowUp: false,
  };
}

export const DISCOVERY_REVIEW_ENUMS = {
  budgetStatus: ["", ...BUDGET_STATUSES],
  engagementType: ["", ...ENGAGEMENT_TYPES],
  deliveryModel: ["", ...DELIVERY_MODELS],
  ipDisposition: ["", ...IP_DISPOSITIONS],
  dataSensitivity: ["", ...DATA_SENSITIVITIES],
  nextActionCourt: ["", ...NEXT_ACTION_COURTS],
} as const;
