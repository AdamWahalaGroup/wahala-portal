/**
 * Client account hub (design frame 12) — the durable home for one client org. Staff
 * only. Org header + tabs (Overview / Work history / People / Files / Messages); the
 * body shows the work-history timeline and side cards (lifetime totals + people).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getAccountHub } from "@/services/account-hub";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Money } from "@/components/Money";
import { Avatar, PeopleCard } from "@/components/People";
import { ClientMemoEditor } from "@/components/ClientMemoEditor";
import { STATUS_STYLES } from "@/lib/theme";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Work history" },
  { key: "people", label: "People" },
  { key: "files", label: "Files", soon: true },
  { key: "messages", label: "Messages", soon: true },
] as const;

const CLIENT_ROLE_LABELS: Record<string, string> = {
  client_admin: "Primary contact",
  client_user: "Team member",
  client_billing: "Billing",
  client_readonly: "Read-only",
};

const STATUS_PILL: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "Accepted", bg: "#dcf5e3", text: "#15803d" },
  invited: { label: "Invited", bg: "#fff7ed", text: "#b45309" },
  disabled: { label: "Disabled", bg: "#f1f2f4", text: "#4b5159" },
};

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function plural(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

export default async function AccountHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { orgId } = await params;
  const hub = await getAccountHub(ctx, orgId).catch((e) => {
    if (e instanceof StageError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });

  const { tab: tabParam } = await searchParams;
  const realTabs = new Set(["overview", "history", "people"]);
  const tab = realTabs.has(tabParam ?? "") ? tabParam! : "overview";

  // Admin or the org's Account Owner may edit the AI client memory; everyone else
  // sees it read-only (still useful as context).
  const canEditMemo =
    ctx.isAdmin || (ctx.user.role === "account_owner" && ctx.user.id === hub.accountOwner?.id);

  const initials =
    hub.org.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <AppShell
      active="clients"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard/clients">Clients</Link> / {hub.org.name}
      </div>

      {/* Org header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 13,
              background: "var(--ink)",
              color: "var(--white)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
              flex: "none",
            }}
          >
            {initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>{hub.org.name}</h1>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              Client since {fmtDate(hub.org.createdAt)} · {plural(hub.counts.projects, "project")} ·{" "}
              {plural(hub.counts.stages, "stage")}
            </div>
          </div>
        </div>
        {hub.accountOwner && <PeopleCard name={hub.accountOwner.name} role="Account owner" variant="owner" />}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginTop: 22, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          const soon = "soon" in t && t.soon;
          const inner = (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 12px",
                fontSize: 13.5,
                fontWeight: 600,
                color: soon ? "var(--muted-line)" : active ? "var(--ink)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                marginBottom: -1,
                cursor: soon ? "default" : "pointer",
              }}
            >
              {t.label}
              {soon && (
                <span className="kicker" style={{ fontSize: 9, color: "var(--muted-line)" }}>
                  soon
                </span>
              )}
            </span>
          );
          return soon ? (
            <span key={t.key}>{inner}</span>
          ) : (
            <Link key={t.key} href={`/dashboard/clients/${orgId}?tab=${t.key}`} style={{ textDecoration: "none" }}>
              {inner}
            </Link>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab hub={hub} orgId={orgId} canEditMemo={canEditMemo} />}
      {tab === "history" && (
        <section style={{ marginTop: 24 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            Work history ({hub.history.length})
          </div>
          <Timeline items={hub.history} empty="No work yet for this client." />
        </section>
      )}
      {tab === "people" && <PeopleTab hub={hub} />}
    </AppShell>
  );
}

function OverviewTab({
  hub,
  orgId,
  canEditMemo,
}: {
  hub: Awaited<ReturnType<typeof getAccountHub>>;
  orgId: string;
  canEditMemo: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 30, marginTop: 24, alignItems: "start" }}>
      {/* Main */}
      <div>
        {hub.org.intakeNotes && (
          <section
            style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 22 }}
          >
            <div className="kicker" style={{ marginBottom: 8 }}>
              What they're looking for
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>{hub.org.intakeNotes}</p>
          </section>
        )}

        <ClientMemoEditor orgId={orgId} initial={hub.org.aiContextMd ?? ""} canEdit={canEditMemo} />

        <div className="kicker" style={{ marginBottom: 12 }}>
          Recent work
        </div>
        <Timeline items={hub.history.slice(0, 6)} empty="No work yet — scope this client's first project to get started." />
        {hub.history.length > 6 && (
          <Link
            href={`/dashboard/clients/${orgId}?tab=history`}
            style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--cobalt)" }}
          >
            View all {hub.history.length} →
          </Link>
        )}

        {hub.projects.length > 0 && (
          <section style={{ marginTop: 30 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>
              Projects ({hub.projects.length})
            </div>
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {hub.projects.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px 16px",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
                    <div className="kicker" style={{ marginTop: 2 }}>
                      {p.workType ?? p.status}
                    </div>
                  </div>
                  <div style={{ justifySelf: "start" }}>{p.latestStatus ? <StatusBadge status={p.latestStatus} /> : null}</div>
                  <div style={{ color: "var(--muted-line)", textAlign: "right" }}>›</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Side cards */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <LifetimeTotals hub={hub} />
        <PeopleSummary hub={hub} />
      </aside>
    </div>
  );
}

function LifetimeTotals({ hub }: { hub: Awaited<ReturnType<typeof getAccountHub>> }) {
  const rows = [
    { label: "Paid to date", value: formatCents(hub.totals.paidCents) },
    { label: "Accepted work", value: formatCents(hub.totals.acceptedCents) },
    { label: "Open pipeline", value: formatCents(hub.totals.openCents) },
  ];
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)" }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        Lifetime totals
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.label}</span>
            <span className="tabular" style={{ fontSize: 15, fontWeight: 700 }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleSummary({ hub }: { hub: Awaited<ReturnType<typeof getAccountHub>> }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>
        People
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {hub.wahalaPeople.map((p) => (
          <PeopleCard key={p.id} name={p.name} role={p.role} variant={p.role === "Account owner" ? "owner" : "lead"} />
        ))}
        {hub.clientPeople.map((p) => (
          <PeopleCard key={p.id} name={p.name} role={CLIENT_ROLE_LABELS[p.role] ?? "Client"} />
        ))}
        {hub.wahalaPeople.length === 0 && hub.clientPeople.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>No people yet.</p>
        )}
      </div>
    </div>
  );
}

function PeopleTab({ hub }: { hub: Awaited<ReturnType<typeof getAccountHub>> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 24, alignItems: "start" }}>
      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Client contacts ({hub.clientPeople.length})
        </div>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {hub.clientPeople.length === 0 ? (
            <p style={{ padding: 16, margin: 0, color: "var(--muted)", fontSize: 13.5 }}>No contacts yet.</p>
          ) : (
            hub.clientPeople.map((p, i) => {
              const pill = STATUS_PILL[p.status] ?? STATUS_PILL.disabled;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                  }}
                >
                  <Avatar name={p.name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {p.name}
                      <span className="kicker" style={{ marginLeft: 8, fontSize: 10 }}>
                        {CLIENT_ROLE_LABELS[p.role] ?? "Client"}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {p.email}
                    </div>
                  </div>
                  <span style={{ background: pill.bg, color: pill.text, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>
                    {pill.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Wahala team ({hub.wahalaPeople.length})
        </div>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {hub.wahalaPeople.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>No one assigned yet.</p>
          ) : (
            hub.wahalaPeople.map((p) => (
              <PeopleCard key={p.id} name={p.name} role={p.role} variant={p.role === "Account owner" ? "owner" : "lead"} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/** Work-history timeline: status-colored node, project · stage, mono "Label · date · $amount". */
function Timeline({ items, empty }: { items: import("@/services/account-hub").WorkHistoryItem[]; empty: string }) {
  if (items.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: 14 }}>{empty}</p>;
  }
  return (
    <div style={{ position: "relative" }}>
      {items.map((it, i) => {
        const s = STATUS_STYLES[it.status];
        const last = i === items.length - 1;
        return (
          <Link
            key={it.stageId}
            href={`/dashboard/stages/${it.stageId}`}
            style={{ display: "flex", gap: 14, textDecoration: "none", color: "inherit" }}
          >
            {/* Node + connector */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <span style={{ width: 13, height: 13, borderRadius: 999, background: s.dot, marginTop: 3, flex: "none", boxShadow: "0 0 0 3px var(--surface-soft)" }} />
              {!last && <span style={{ width: 2, flex: 1, background: "var(--border)", marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 22, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                {it.projectName} <span style={{ color: "var(--muted-line)" }}>·</span> {it.stageName}
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                <span style={{ color: s.text, fontWeight: 600 }}>{it.atLabel}</span> · {fmtDate(it.at)} ·{" "}
                {formatCents(it.amountCents)}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
