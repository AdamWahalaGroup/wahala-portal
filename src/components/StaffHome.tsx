/**
 * Staff home / admin landing (design frame 17) — "who are my clients and where does
 * the money stand." Two revenue cards + a clients table. NOT a project/stage worklist.
 */
import Link from "next/link";
import type { AuthContext } from "@/auth/context";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/People";
import { TodayStrip, MeetingInbox } from "@/components/TodayStrip";
import { staffRevenueOverview } from "@/services/staff-home";
import { salesOverview } from "@/services/sales";
import { calendarConnection } from "@/services/integrations/google-calendar";
import { syncIfStale, todayMeetings, meetingInbox } from "@/services/meetings";
import { NEXT_ACTION_COURT_LABELS, nextActionTiming } from "@/domain/deal-operating-model";

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function StaffHome({ ctx }: { ctx: AuthContext }) {
  await syncIfStale(ctx); // frame 45: the strip + inbox read the synced meetings table
  const [ov, sales, connection, today, inbox] = await Promise.all([
    staffRevenueOverview(ctx),
    salesOverview(ctx),
    calendarConnection(ctx.user.id),
    todayMeetings(ctx),
    meetingInbox(ctx),
  ]);
  const openDealsForLink = sales.columns.flatMap((c) => c.deals).map((d) => ({ id: d.id, name: d.name, orgName: d.organizationName }));
  const openDealCount = sales.columns.reduce((n, c) => n + c.deals.length, 0);
  const newOppCount = sales.newOppCount;
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
          {newOppCount > 0 ? ` · ${newOppCount} new opportunit${newOppCount === 1 ? "y" : "ies"} to accept` : ""}
        </span>
        {sales.stuckCount > 0 && (
          <span className="kicker" style={{ fontSize: 10, background: "#fff7ed", color: "#b45309", padding: "3px 8px", borderRadius: 6 }}>
            ⚠ {sales.stuckCount} stuck 14d+
          </span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--muted-line)" }}>›</span>
      </Link>

      {/* Work this next — dated commitments first. Portfolio attractiveness breaks
          ties; a stale deal must never disappear because its health declined. */}
      {(() => {
        const queue = sales.columns
          .flatMap((c) => c.deals)
          .sort((a, b) => b.actionUrgencyScore - a.actionUrgencyScore || (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
          .slice(0, 5);
        if (queue.length === 0) return null;
        return (
          <section style={{ marginTop: 16, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span className="kicker" style={{ color: "#2536C4" }}>◆ Work this next</span>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
                commitments first · portfolio fit breaks ties
              </span>
            </div>
            {queue.map((d, i) => {
              const meetingIsFollowUp = !d.nextAction && !!d.nextMeetingAt;
              const timing = nextActionTiming({
                nextAction: meetingIsFollowUp ? d.nextMeetingTitle ?? "Scheduled meeting" : d.nextAction,
                nextActionDueAt: meetingIsFollowUp ? d.nextMeetingAt : d.nextActionDueAt,
                now,
              });
              return (
                <Link
                  key={d.id}
                  href={`/dashboard/sales/deals/${d.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-softer)", textDecoration: "none", color: "inherit" }}
                >
                <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: "var(--muted-line)", flex: "none", width: 16 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{d.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                    {d.organizationName} · {usd(d.valueCents)}
                  </span>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    → {d.nextStep}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, borderRadius: 999, padding: "2px 8px", flex: "none", background: timing.tone === "red" ? "#FBE3E3" : timing.tone === "amber" ? "#FCEFDC" : "#F1F2F4", color: timing.tone === "red" ? "#B91C1C" : timing.tone === "amber" ? "#B45309" : "var(--ink-soft)" }}>
                  {timing.label} · {meetingIsFollowUp ? "Meeting" : NEXT_ACTION_COURT_LABELS[d.nextActionCourt]}
                </span>
                {d.fitScore !== null && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      borderRadius: 999,
                      padding: "2px 8px",
                      flex: "none",
                      background: d.fitScore >= 7 ? "#DCF5E3" : d.fitScore >= 4 ? "#FCEFDC" : "#FBE3E3",
                      color: d.fitScore >= 7 ? "#15803D" : d.fitScore >= 4 ? "#B45309" : "#B91C1C",
                    }}
                  >
                    fit {d.fitScore}
                  </span>
                )}
                <span className="tabular" style={{ fontSize: 12, fontWeight: 800, color: "#2536C4", flex: "none" }}>{d.priorityScore}</span>
              </Link>
              );
            })}
          </section>
        );
      })()}

      {/* Today strip + meeting inbox (frame 45) */}
      {!connection.connected && (
        <p className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)", margin: "14px 0 0" }}>
          your meetings can live here —{" "}
          <Link href="/dashboard/settings/integrations" style={{ color: "var(--cobalt-text)", fontWeight: 700, textDecoration: "none" }}>
            connect Google Calendar in Settings →
          </Link>
        </p>
      )}
      <TodayStrip
        meetings={today.map((m) => ({
          id: m.id,
          title: m.title,
          startsAt: m.startsAt.toISOString(),
          videoUrl: m.videoUrl,
          dealId: m.dealId,
          dealName: m.dealName,
        }))}
      />
      {(ctx.isAdmin || ctx.user.role === "account_owner") && (
        <MeetingInbox
          items={inbox.map((m) => ({
            id: m.id,
            title: m.title,
            startsAt: m.startsAt.toISOString(),
            reason: m.reason,
            suggestedOrganizationId: m.suggestedOrganizationId,
            suggestedOrgName: m.suggestedOrgName,
            hasTranscript: m.hasTranscript,
          }))}
          deals={openDealsForLink}
        />
      )}

      {/* Accounts table */}
      <section style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="kicker">Accounts</div>
          <div className="kicker" style={{ color: "var(--muted)" }}>{ov.activeClientCount} clients</div>
        </div>

        {ov.clients.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>No accounts yet.</p>
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
              <span>Account</span>
              <span style={{ textAlign: "right" }}>Paid to date</span>
              <span style={{ textAlign: "right" }}>Promised</span>
              <span />
            </div>
            {ov.clients.map((c, i) => (
              <Link
                key={c.orgId}
                href={`/dashboard/accounts/${c.orgId}`}
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
