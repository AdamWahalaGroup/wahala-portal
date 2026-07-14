/**
 * Proposal & Contract/SOW document types (HANDOFF-DELTA-2026-07-07) — pure
 * types, client-safe. The phased sign-off model: one master client signature,
 * then each later phase activated/amended in-app without re-signing. The
 * contract is a one-time SNAPSHOT of the chosen option (not a live binding).
 *
 * All money is integer CENTS (prototype used dollars; every constant ×100).
 */

export type PhaseStatus = "awaiting_amendment" | "active" | "done";

/** Client-facing substance that survives proposal review into the Contract/SOW. */
export type ProposalScopeDetails = {
  objective: string;
  scopeItems: string[];
  deliverables: string[];
  acceptanceCriteria: string[];
  exclusions: string[];
};

export type ProposalCoverageDisposition = "included" | "deferred" | "question";

export type ProposalCoveragePlacement = {
  optionLabel: string;
  disposition: ProposalCoverageDisposition;
  phaseName: string | null;
  note: string;
};

/** Internal review aid: every explicit MVP capability must have a visible disposition. */
export type ProposalCoverageReview = {
  items: { priority: string; placements: ProposalCoveragePlacement[] }[];
  warnings: string[];
};

/** A phase inside a proposal option. null phases on the option = lump-sum. */
export type ProposalPhase = {
  name: string;
  amountCents: number;
  weeks: number;
  status: PhaseStatus;
  /** Optional staff note; seeds the contract phase's objective/scope text. */
  internalNote?: string;
  /** Structured AI draft, editable by staff and copied into the Contract/SOW. */
  scopeDetails?: ProposalScopeDetails;
};

/** Who on the client side can sign / approve amendments. */
export type Approver = { name: string; role: string };

export type ContractPhase = {
  name: string;
  amountCents: number;
  weeks: number | null; // null for lump-sum single-card contracts
  objective: string;
  scopeText: string; // one item per line (flat textarea by design — §5.5)
  deliverablesText: string;
  acceptanceText: string;
};

export type ContractStatus = "draft" | "sent" | "executed";

/**
 * The Contract/SOW document, stored as one JSON snapshot on the proposal.
 * Draft = editable; Sent = locked (revertable); Executed = locked forever,
 * changes only as appended amendment log entries.
 */
export type ProposalContract = {
  status: ContractStatus;
  proposalNumber: string; // WG-2026-NNN
  scopeOfEngagement: string;
  phases: ContractPhase[];
  depositPct: number;
  outOfScopeEnabled: boolean;
  outOfScopeText: string;
  changeManagementEnabled: boolean;
  changeManagementText: string;
  acceptanceReviewDays: number;
  clientSignerName: string;
  clientSignerTitle: string;
  ourSignerName: string;
  ourSignerTitle: string;
  /** Which proposal option this was generated from + its phase fingerprint. */
  sourceOptionId: string;
  sourceSignature: string;
  /** Appended only while executed — a change order is a new entry, never an edit. */
  amendments: { note: string; at: string }[];
  generatedAt: string;
};
