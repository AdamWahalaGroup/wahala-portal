/**
 * Wahala's deal operating model.
 *
 * These values describe different commercial questions. Do not collapse them
 * into a single "AI score": engagement type, delivery shape, IP rights, data
 * risk, qualification evidence, portfolio attractiveness, and action urgency
 * each support a different human decision.
 */

export const ENGAGEMENT_TYPES = [
  "product_license",
  "modernization",
  "custom_build",
  "paid_discovery",
  "advisory",
  "support",
] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const DELIVERY_MODELS = [
  "one_shot",
  "phased",
  "paid_discovery_then_build",
  "time_and_materials",
  "license_enablement",
  "recurring",
] as const;
export type DeliveryModel = (typeof DELIVERY_MODELS)[number];

export const IP_DISPOSITIONS = [
  "undecided",
  "wahala_retains_background_ip",
  "client_owns_configured_fork",
  "nonexclusive_license",
  "exclusive_license",
  "full_assignment",
] as const;
export type IpDisposition = (typeof IP_DISPOSITIONS)[number];

export const DATA_SENSITIVITIES = ["standard", "confidential", "high_risk"] as const;
export type DataSensitivity = (typeof DATA_SENSITIVITIES)[number];

export const BUDGET_STATUSES = ["unknown", "authority_known", "funding_path", "confirmed"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const NEXT_ACTION_COURTS = ["wahala", "client", "third_party"] as const;
export type NextActionCourt = (typeof NEXT_ACTION_COURTS)[number];

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  product_license: "Product license / transfer",
  modernization: "Existing-system modernization",
  custom_build: "Custom product build",
  paid_discovery: "Paid discovery / assessment",
  advisory: "Advisory / consulting",
  support: "Support / managed service",
};

export const DELIVERY_MODEL_LABELS: Record<DeliveryModel, string> = {
  one_shot: "One-shot fixed delivery",
  phased: "Phased fixed-price delivery",
  paid_discovery_then_build: "Paid discovery, then build",
  time_and_materials: "Time and materials",
  license_enablement: "License plus enablement",
  recurring: "Recurring service",
};

export const IP_DISPOSITION_LABELS: Record<IpDisposition, string> = {
  undecided: "Undecided",
  wahala_retains_background_ip: "Wahala retains background IP",
  client_owns_configured_fork: "Client owns configured fork",
  nonexclusive_license: "Non-exclusive license",
  exclusive_license: "Exclusive license",
  full_assignment: "Full IP assignment",
};

export const DATA_SENSITIVITY_LABELS: Record<DataSensitivity, string> = {
  standard: "Standard",
  confidential: "Confidential customer data",
  high_risk: "High-risk / regulated data",
};

/**
 * Classify the most sensitive data the proposed engagement may receive, store,
 * transmit, or send to a third-party provider. These descriptions are operating
 * guidance, not legal conclusions.
 */
export const DATA_SENSITIVITY_DESCRIPTIONS: Record<DataSensitivity, string> = {
  standard:
    "Public or low-sensitivity operational data. No privileged, regulated, or materially confidential client information is expected.",
  confidential:
    "Non-public customer or business information that needs controlled access, retention, deletion, and contractual handling rules.",
  high_risk:
    "Privileged, court-protected, identifying, biometric, health, financial, or other regulated data. Security, legal, retention, and provider approval are required before use.",
};

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  unknown: "Unknown",
  authority_known: "Spending authority known",
  funding_path: "Funding path identified",
  confirmed: "Budget confirmed",
};

export const NEXT_ACTION_COURT_LABELS: Record<NextActionCourt, string> = {
  wahala: "Wahala",
  client: "Client",
  third_party: "Third party",
};

export function isEngagementType(value: string): value is EngagementType {
  return (ENGAGEMENT_TYPES as readonly string[]).includes(value);
}

export function isDeliveryModel(value: string): value is DeliveryModel {
  return (DELIVERY_MODELS as readonly string[]).includes(value);
}

export function isIpDisposition(value: string): value is IpDisposition {
  return (IP_DISPOSITIONS as readonly string[]).includes(value);
}

export function isDataSensitivity(value: string): value is DataSensitivity {
  return (DATA_SENSITIVITIES as readonly string[]).includes(value);
}

export function isBudgetStatus(value: string): value is BudgetStatus {
  return (BUDGET_STATUSES as readonly string[]).includes(value);
}

export function isNextActionCourt(value: string): value is NextActionCourt {
  return (NEXT_ACTION_COURTS as readonly string[]).includes(value);
}

const DAY_MS = 86_400_000;

// Deal dates are business calendar dates, not countdown timestamps. Comparing
// UTC date parts prevents a YYYY-MM-DD value from becoming "overdue" at noon.
function calendarDaysUntil(due: Date, now: Date): number {
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()) / DAY_MS;
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / DAY_MS;
  return dueDay - nowDay;
}

/**
 * A commitment queue is not a win-probability queue. Missing or overdue dated
 * commitments rise to the top; portfolio attractiveness only breaks ties.
 */
export function actionUrgencyScore(input: {
  nextAction: string | null;
  nextActionDueAt: Date | null;
  now: Date;
}): number {
  if (!input.nextAction?.trim() || !input.nextActionDueAt) return 100;
  const daysUntil = calendarDaysUntil(input.nextActionDueAt, input.now);
  if (daysUntil < 0) return Math.min(100, 90 + Math.abs(daysUntil) * 2);
  if (daysUntil === 0) return 90;
  if (daysUntil === 1) return 80;
  if (daysUntil === 2) return 70;
  if (daysUntil <= 3) return 60;
  if (daysUntil <= 7) return 45;
  return 20;
}

export function nextActionTiming(input: {
  nextAction: string | null;
  nextActionDueAt: Date | null;
  now: Date;
}): { tone: "red" | "amber" | "neutral"; label: string } {
  if (!input.nextAction?.trim()) return { tone: "red", label: "next commitment missing" };
  if (!input.nextActionDueAt) return { tone: "red", label: "due date missing" };
  const daysUntil = calendarDaysUntil(input.nextActionDueAt, input.now);
  if (daysUntil < -1) return { tone: "red", label: `${Math.abs(daysUntil)}d overdue` };
  if (daysUntil < 0) return { tone: "red", label: "overdue" };
  if (daysUntil === 0) return { tone: "amber", label: "due today" };
  if (daysUntil === 1) return { tone: "amber", label: "due tomorrow" };
  return { tone: "neutral", label: `due in ${daysUntil}d` };
}
