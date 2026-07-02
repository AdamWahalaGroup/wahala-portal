/**
 * The ONE chip system for the sales pipeline (design handoff, sales/00-overview.md).
 * Replaces the ad-hoc chips that accreted across the sales screens. Presentational —
 * usable from server pages and client islands alike.
 */
import type { DealStage } from "@/domain/sales";

export const VERDICT_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  pursue: { bg: "#DCF5E3", color: "#15803D", dot: "#16A34A" },
  probe: { bg: "#FCEFDC", color: "#B45309", dot: "#D97706" },
  pass: { bg: "#F1F2F4", color: "#6B7280", dot: "#9AA0AA" },
};

/** Lead score chip: `8/10 · PURSUE`, verdict-colored, mono/tnum number. */
export function ScoreChip({
  score,
  verdict,
  size = "sm",
}: {
  score: number | null;
  verdict: string | null;
  size?: "sm" | "lg";
}) {
  const v = VERDICT_STYLES[verdict ?? "pass"] ?? VERDICT_STYLES.pass;
  if (score === null) {
    return (
      <span className="kicker" style={{ fontSize: size === "lg" ? 10.5 : 9.5, padding: size === "lg" ? "5px 11px" : "3px 8px", borderRadius: 999, background: "#F1F2F4", color: "#6B7280" }}>
        not scored
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: size === "lg" ? 13 : 10.5,
        fontWeight: 800,
        letterSpacing: ".02em",
        padding: size === "lg" ? "6px 12px" : "3px 9px",
        borderRadius: 999,
        background: v.bg,
        color: v.color,
      }}
    >
      <span style={{ width: size === "lg" ? 8 : 6, height: size === "lg" ? 8 : 6, borderRadius: 999, background: v.dot }} />
      <span className="tabular">{score}/10</span>
      <span style={{ textTransform: "uppercase", fontSize: size === "lg" ? 10.5 : 9 }}>{verdict}</span>
    </span>
  );
}

/** Proposal complexity chip: C{n}; ≤3 neutral cobalt, >3 amber with ⚠ (soft flag). */
export function ComplexityChip({ score }: { score: number | null }) {
  if (score === null) return null;
  const hot = score > 3;
  return (
    <span
      className="kicker"
      style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 6, background: hot ? "#FCEFDC" : "#EEF0FE", color: hot ? "#B45309" : "#2536C4", flex: "none" }}
      title={hot ? "Above the fast-track line — needs engineering review (soft flag)" : "Fast-track territory"}
    >
      {hot ? "⚠ " : ""}C{score}
    </span>
  );
}

export const PROPOSAL_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F1F2F4", color: "#4B5159", label: "Draft" },
  sent: { bg: "#E8EFFE", color: "#1D4ED8", label: "Sent" },
  approved: { bg: "#DCF5E3", color: "#15803D", label: "Approved" },
  declined: { bg: "#FBE3E3", color: "#B91C1C", label: "Declined" },
  superseded: { bg: "#F4F5F7", color: "#767B85", label: "Superseded" },
};

export function ProposalStatusPill({ status, version }: { status: string; version?: number }) {
  const s = PROPOSAL_STATUS_STYLES[status] ?? PROPOSAL_STATUS_STYLES.draft;
  return (
    <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: s.bg, color: s.color, flex: "none" }}>
      {s.label}
      {version ? ` · v${version}` : ""}
    </span>
  );
}

/** Days-in-stage: mono neutral, flips to the amber ⚠ stuck tag at 14d. */
export function DaysTag({ days, stuck }: { days: number; stuck: boolean }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10.5,
        padding: "3px 8px",
        borderRadius: 6,
        flex: "none",
        background: stuck ? "#FFF7ED" : "#F4F5F7",
        border: stuck ? "1px solid #FADCB4" : "1px solid transparent",
        color: stuck ? "#B45309" : "var(--muted)",
        fontWeight: stuck ? 700 : 500,
      }}
      title={stuck ? "In this stage 14+ days — worth a look at Monday's meeting" : undefined}
    >
      {stuck ? "⚠ " : ""}
      {days}d
    </span>
  );
}

/** One select style for stage dropdowns everywhere. */
export const stageSelectStyle: React.CSSProperties = {
  border: "1px solid #E2E3E8",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 13,
  fontWeight: 600,
  background: "var(--white)",
};

/** Stage identity colors — section headers, spine nodes. */
export const STAGE_COLORS: Record<DealStage, string> = {
  discovery: "#2563EB",
  business_requirements: "#0D9488",
  solution_design: "#7C3AED",
  proposal: "#0891B2",
  negotiation: "#D97706",
  contract: "#4B5159",
  won: "#16A34A",
  lost: "#B91C1C",
};
