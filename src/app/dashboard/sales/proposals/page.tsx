/**
 * Proposals index — every proposal across every deal (the Proposals sub-nav
 * destination). Staff only.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listAllProposals } from "@/services/proposals";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesTabs } from "@/components/SalesTabs";
import { ProposalStatusPill, ComplexityChip } from "@/components/SalesChips";

export const dynamic = "force-dynamic";

export default async function ProposalsIndexPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const proposals = await listAllProposals(ctx);
  const open = proposals.filter((p) => p.status === "draft" || p.status === "sent");
  const closed = proposals.filter((p) => p.status !== "draft" && p.status !== "sent");

  const Row = ({ p, muted }: { p: (typeof proposals)[number]; muted?: boolean }) => (
    <Link
      href={`/dashboard/sales/proposals/${p.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--white)",
        border: "1px solid #ededf1",
        borderRadius: 11,
        padding: "11px 14px",
        textDecoration: "none",
        color: "inherit",
        opacity: muted ? 0.7 : 1,
      }}
    >
      <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", flex: "none" }}>v{p.version}</span>
      <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {p.title}
      </span>
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flex: "none" }}>
        {p.organizationName}
      </span>
      <ComplexityChip score={p.complexityScore} />
      {p.selectedLabel && (
        <span className="kicker" style={{ flex: "none", fontSize: 9.5, padding: "3px 7px", borderRadius: 5, background: "#DCF5E3", color: "#15803D" }}>
          Option {p.selectedLabel}
        </span>
      )}
      <ProposalStatusPill status={p.status} />
      <span style={{ color: "var(--muted-line)", flex: "none" }}>›</span>
    </Link>
  );

  return (
    <AppShell
      active="sales-proposals"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            <Link href="/dashboard/sales">Sales</Link> / Proposals
          </div>
          <h1 style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Proposals</h1>
        </div>
        <SalesTabs active="proposals" />
      </div>

      <section style={{ marginTop: 24 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Open ({open.length})</div>
        {open.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
            Nothing in flight — draft one from a deal room.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {open.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Responded / superseded ({closed.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {closed.map((p) => (
              <Row key={p.id} p={p} muted />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
