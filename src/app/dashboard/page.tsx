/**
 * Dashboard — what's "on you", then your projects. Wrapped in the app shell.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { WaitingOn } from "@/components/WaitingOn";
import { Money } from "@/components/Money";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { ClientWelcome } from "@/components/ClientWelcome";
import { AutoRefresh } from "@/components/AutoRefresh";
import { onYouCta, waitingParty } from "@/lib/stage-ui";

export const dynamic = "force-dynamic";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function Dashboard() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const sdb = scopedDb(ctx);
  const [projects, allStages, org, accountOwner] = await Promise.all([
    sdb.listProjects(),
    sdb.listAllStages(),
    sdb.currentOrganization(),
    sdb.accountOwner(),
  ]);

  const projName = new Map(projects.map((p) => [p.id, p.name]));
  const latest = new Map<string, (typeof allStages)[number]>();
  for (const s of allStages) if (!latest.has(s.projectId)) latest.set(s.projectId, s);

  const onYou = allStages.filter((s) => onYouCta(s.status, ctx.isStaff)).slice(0, 6);
  const canCreateProject = ctx.isAdmin || ctx.user.role === "account_owner";
  const orgs = canCreateProject ? await sdb.listOrganizations() : [];
  const firstName = (ctx.user.name.split(/\s+/)[0] || ctx.user.name).replace(/[^A-Za-z].*$/, "");
  const isNewClient = !ctx.isStaff && projects.length === 0;

  return (
    <AppShell
      active="home"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={org?.name ?? (ctx.isStaff ? "Wahala Group" : null)}
      accountOwner={accountOwner}
    >
      <AutoRefresh enabled={onYou.length > 0 || isNewClient} />
      {isNewClient ? (
        <ClientWelcome firstName={firstName} agent={accountOwner} orgId={ctx.organizationId} />
      ) : (
        <>
      <div className="kicker">{ctx.isStaff ? "Wahala staff" : org?.name ?? "Client"}</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>
        {greeting(new Date().getHours())}, {firstName}.
      </h1>

      {/* On you */}
      {onYou.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            {ctx.isStaff ? "Needs Wahala" : "On you"}
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {onYou.map((s) => {
              const cta = onYouCta(s.status, ctx.isStaff)!;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    background: "#fff7ed",
                    border: "1px solid #fadcb4",
                    borderRadius: 12,
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="kicker" style={{ color: "#b88534" }}>
                      {projName.get(s.projectId) ?? "Project"}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 2 }}>{s.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
                    <StatusBadge status={s.status} />
                    <Money cents={s.totalAmountCents} style={{ fontWeight: 700, fontSize: 15 }} />
                    <Link
                      href={!ctx.isStaff && s.status === "delivered" ? `/dashboard/stages/${s.id}/accept` : `/dashboard/stages/${s.id}`}
                      style={{
                        background: "var(--ink)",
                        color: "var(--white)",
                        borderRadius: 9,
                        padding: "9px 14px",
                        fontSize: 13.5,
                        fontWeight: 600,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cta}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Projects */}
      <section style={{ marginTop: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Your projects ({projects.length})
        </div>
        {projects.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No projects yet.</p>
        ) : (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {projects.map((p, i) => {
              const s = latest.get(p.id);
              const party = s ? waitingParty(s.status) : "none";
              const who = party === "none" ? null : (ctx.isStaff ? party === "wahala" : party === "client") ? "you" : "wahala";
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/projects/${p.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px 168px 16px",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div className="kicker" style={{ marginTop: 2 }}>
                      {p.workType ?? p.status}
                    </div>
                  </div>
                  <div style={{ justifySelf: "start" }}>{s ? <StatusBadge status={s.status} /> : null}</div>
                  <div style={{ justifySelf: "start" }}>{who ? <WaitingOn who={who} /> : null}</div>
                  <div style={{ color: "var(--muted-line)", textAlign: "right" }}>›</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Staff: new project */}
      {canCreateProject && (
        <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            New project
          </div>
          <CreateProjectForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
        </section>
      )}
        </>
      )}
    </AppShell>
  );
}
