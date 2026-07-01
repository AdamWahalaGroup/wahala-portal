/**
 * Staff home / admin landing (design frame 17) — "who are my clients and where does
 * the money stand." Two revenue cards + a clients table. NOT a project/stage worklist.
 */
import Link from "next/link";
import type { AuthContext } from "@/auth/context";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/People";
import { staffRevenueOverview } from "@/services/staff-home";
import { salesOverview } from "@/services/sales";

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function StaffHome({ ctx }: { ctx: AuthContext }) {
  const [ov, sales] = await Promise.all([staffRevenueOverview(ctx), salesOverview(ctx)]);
  const openDealCount = sales.columns.reduce((n, c) => n + c.deals.length, 0);
  const newLeadCount = sales.leads.filter((l) => l.status === "new").length;
  const now = new Date();
  const firstName = (ctx.user.name.split(/\s+/)[0] || ctx.user.name).replace(/[^A-Za-z].*$/, "");
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <AppShell
      active="home"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      {/* Header */}
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{dateLine}</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>
        {greeting(now.getHours())}, {firstName}.
      </h1>

      {/* Two revenue summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <div style={{ background: "#F4FBF7", border: "1px solid #D6EFE4", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16a34a" }} />
            <span className="kicker" style={{ color: "#15803d" }}>Collected to date</span>
          </div>
          <div className="tabular" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.02em", marginTop: 8, color: "var(--ink)" }}>
            {usd(ov.collectedCents)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Across {ov.collectedClientCount} client{ov.collectedClientCount === 1 ? "" : "s"} · payments received
          </div>
        </div>

        <div style={{ background: "#FFFAF2", border: "1px solid #FADCB4", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#ea8a0d" }} />
            <span className="kicker" style={{ color: "#b45309" }}>Promised on completion</span>
          </div>
          <div className="tabular" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.02em", marginTop: 8, color: "var(--ink)" }}>
            {usd(ov.promisedCents)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Agreed work · not yet collected
          </div>
        </div>
      </div>

      {/* Sales pipeline strip — the front half of the funnel, one glance */}
      <Link
        href="/dashboard/sales"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 16,
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "14px 20px",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <span className="kicker">Sales pipeline</span>
        <span className="tabular" style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.01em" }}>
          {usd(sales.openPipelineCents)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {openDealCount} open deal{openDealCount === 1 ? "" : "s"}
          {newLeadCount > 0 ? ` · ${newLeadCount} lead${newLeadCount === 1 ? "" : "s"} to qualify` : ""}
        </span>
        {sales.stuckCount > 0 && (
          <span className="kicker" style={{ fontSize: 10, background: "#fff7ed", color: "#b45309", padding: "3px 8px", borderRadius: 6 }}>
            ⚠ {sales.stuckCount} stuck 14d+
          </span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--muted-line)" }}>›</span>
      </Link>

      {/* Clients table */}
      <section style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="kicker">Clients</div>
          <div className="kicker" style={{ color: "var(--muted)" }}>{ov.activeClientCount} active</div>
        </div>

        {ov.clients.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No clients yet.</p>
        ) : (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {/* Column labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 150px 150px 16px",
                gap: 12,
                padding: "9px 16px",
                background: "var(--surface-soft)",
                borderBottom: "1px solid var(--border-soft)",
              }}
              className="kicker"
            >
              <span>Client</span>
              <span style={{ textAlign: "right" }}>Paid to date</span>
              <span style={{ textAlign: "right" }}>Promised</span>
              <span />
            </div>
            {ov.clients.map((c, i) => (
              <Link
                key={c.orgId}
                href={`/dashboard/clients/${c.orgId}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 150px 150px 16px",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar name={c.orgName} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.orgName}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                      {c.projectCount} project{c.projectCount === 1 ? "" : "s"}
                      {c.ownerName ? ` · owner ${c.ownerName}` : ""}
                    </div>
                  </div>
                </div>
                <div className="tabular" style={{ textAlign: "right", fontSize: 13.5, fontWeight: 700, color: c.paidToDateCents > 0 ? "var(--ink)" : "var(--muted-line)" }}>
                  {usd(c.paidToDateCents)}
                </div>
                <div className="tabular" style={{ textAlign: "right", fontSize: 13.5, fontWeight: 700, color: c.promisedCents > 0 ? "#b45309" : "var(--muted-line)" }}>
                  {usd(c.promisedCents)}
                </div>
                <div style={{ color: "var(--muted-line)", textAlign: "right" }}>›</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
