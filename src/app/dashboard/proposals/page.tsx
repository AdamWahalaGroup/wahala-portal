/**
 * Proposals index (HANDOFF-DELTA-2026-07-07 §2) — flat list, ONE row per deal
 * with a live proposal: deal, account, headline value (chosen/recommended/first
 * option), complexity chip, status pill. First-class nav item with sent-count badge.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listAllProposals, countSentProposals } from "@/services/proposals";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { Money } from "@/components/Money";
import { ProposalStatusPill, ComplexityChip } from "@/components/SalesChips";

export const dynamic = "force-dynamic";

export default async function ProposalsIndexPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const [rows, proposalCount] = await Promise.all([listAllProposals(ctx), countSentProposals(ctx)]);

  return (
    <AppShell
      active="proposals"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      proposalCount={proposalCount}
      wide
    >
      <div className="kicker">Sales</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Proposals</h1>
      <p style={{ margin: "6px 0 22px", color: "var(--muted)", fontSize: 14.5 }}>
        One live proposal per deal — drafting starts on the deal; the paper and its phased sign-off live here.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No proposals yet — rough one out from a deal.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/proposals/${p.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--white)",
                border: "1px solid #ededf1",
                borderRadius: 11,
                padding: "12px 15px",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.dealName}</span>
                <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--muted-line)", marginTop: 2 }}>
                  {p.organizationName} · v{p.version}
                </span>
              </span>
              {p.priceCents > 0 && <Money cents={p.priceCents} style={{ fontWeight: 800, fontSize: 14.5, flex: "none" }} />}
              <ComplexityChip score={p.complexityScore} />
              <ProposalStatusPill status={p.status} />
              {p.status === "draft" && (
                <span className="mono" style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: "3px 7px", background: p.draftNeedsRefresh ? "#FCEFDC" : "#EEF0FE", color: p.draftNeedsRefresh ? "#B45309" : "#2536C4" }}>
                  {p.draftNeedsRefresh ? "needs refresh" : "in progress"}
                </span>
              )}
              <span style={{ color: "var(--muted-line)", flex: "none" }}>›</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
