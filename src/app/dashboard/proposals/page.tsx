/**
 * Proposals index — every proposal across every deal (staff, scoped). Jason
 * feedback: a full page dedicated to proposals. Open work (draft/sent) groups
 * before responded/superseded; rows deep-link to the full proposal page.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listAllProposals, type ProposalIndexRow } from "@/services/proposals";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { ProposalStatusPill, ComplexityChip } from "@/components/SalesChips";

export const dynamic = "force-dynamic";

function ProposalRow({ p }: { p: ProposalIndexRow }) {
  return (
    <Link
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
        opacity: p.status === "superseded" ? 0.6 : 1,
      }}
    >
      <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", flex: "none" }}>v{p.version}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
        <span className="mono" style={{ display: "block", fontSize: 10.5, color: "var(--muted-line)", marginTop: 2 }}>
          {p.dealName} · {p.organizationName}
        </span>
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
}

export default async function ProposalsIndexPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const rows = await listAllProposals(ctx);
  const open = rows.filter((p) => p.status === "draft" || p.status === "sent");
  const closed = rows.filter((p) => p.status !== "draft" && p.status !== "sent");

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      wide
    >
      <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)" }}>
        <Link href="/dashboard/sales" style={{ color: "inherit" }}>Sales board</Link> / Proposals
      </div>
      <h1 style={{ margin: "14px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>Proposals</h1>
      <p style={{ margin: "6px 0 22px", color: "var(--muted)", fontSize: 14.5 }}>
        Every version across every deal. Drafting happens on the deal — this is where the paper lives.
      </p>

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No proposals yet — draft one from a deal.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {open.length > 0 && (
            <section>
              <div className="kicker" style={{ marginBottom: 8 }}>In play ({open.length})</div>
              <div style={{ display: "grid", gap: 8 }}>{open.map((p) => <ProposalRow key={p.id} p={p} />)}</div>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <div className="kicker" style={{ marginBottom: 8 }}>Responded &amp; superseded ({closed.length})</div>
              <div style={{ display: "grid", gap: 8 }}>{closed.map((p) => <ProposalRow key={p.id} p={p} />)}</div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}
