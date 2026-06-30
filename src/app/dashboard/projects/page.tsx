/**
 * Projects, staff (design frame 16) — a cross-client list of all projects, grouped
 * into a distinct block per client. Staff only; tenant-scoped (only orgs in reach).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/People";
import type { StageStatus } from "@/domain/stage-machine";

export const dynamic = "force-dynamic";

export default async function StaffProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const sdb = scopedDb(ctx);
  const [projects, allStages, orgs, staff] = await Promise.all([
    sdb.listProjects(),
    sdb.listAllStages(),
    sdb.listOrganizations(),
    listWahalaStaff(ctx),
  ]);

  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().toLowerCase();
  const canCreateProject = ctx.isAdmin || ctx.user.role === "account_owner";

  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const ownerName = new Map(staff.map((s) => [s.id, s.name]));
  const latest = new Map<string, StageStatus>();
  for (const s of allStages) if (!latest.has(s.projectId)) latest.set(s.projectId, s.status as StageStatus);

  const matched = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q) || (orgName.get(p.organizationId) ?? "").toLowerCase().includes(q))
    : projects;

  // Group projects by org; keep orgs that have matching projects, sorted by name.
  const byOrg = new Map<string, typeof matched>();
  for (const p of matched) {
    const arr = byOrg.get(p.organizationId) ?? [];
    arr.push(p);
    byOrg.set(p.organizationId, arr);
  }
  const groups = orgs
    .filter((o) => byOrg.has(o.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => ({ org: o, projects: byOrg.get(o.id)! }));

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="kicker">Projects</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Projects</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14.5 }}>Across all your clients.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <form>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search projects or clients"
              style={{ padding: "9px 12px", fontSize: 13.5, border: "1px solid var(--border)", borderRadius: 9, background: "var(--white)", width: 240, fontFamily: "inherit" }}
            />
          </form>
          {canCreateProject && orgs.length > 0 && (
            <>
              <Link
                href="/dashboard/projects/new?ai=1"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 14px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#2536C4",
                  background: "var(--white)",
                  border: "1px solid #C9D0FB",
                  borderRadius: 9,
                  textDecoration: "none",
                }}
              >
                ◆ Draft with AI
              </Link>
              <Link
                href="/dashboard/projects/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "9px 14px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--white)",
                  background: "var(--ink)",
                  borderRadius: 9,
                  textDecoration: "none",
                }}
              >
                + New project
              </Link>
            </>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 24 }}>
          {q ? `No projects or clients match "${rawQ}".` : "No projects yet."}
        </p>
      ) : (
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 30 }}>
          {groups.map(({ org, projects: ps }) => (
            <section key={org.id}>
              {/* Client heading */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 8,
                  borderBottom: "2px solid var(--ink)",
                }}
              >
                <Link href={`/dashboard/clients/${org.id}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "inherit", minWidth: 0 }}>
                  <Avatar name={org.name} size={30} />
                  <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.015em" }}>{org.name}</span>
                  <span className="kicker" style={{ color: "var(--muted)" }}>
                    {ps.length} project{ps.length === 1 ? "" : "s"}
                  </span>
                </Link>
                {org.accountOwnerUserId && ownerName.get(org.accountOwnerUserId) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    <Avatar name={ownerName.get(org.accountOwnerUserId)!} variant="owner" size={24} />
                    <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{ownerName.get(org.accountOwnerUserId)}</span>
                  </div>
                )}
              </div>

              {/* Project rows */}
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                {ps.map((p, i) => {
                  const st = latest.get(p.id);
                  return (
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
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                        <div className="kicker" style={{ marginTop: 2 }}>
                          {p.workType ?? p.status}
                        </div>
                      </div>
                      <div style={{ justifySelf: "start" }}>{st ? <StatusBadge status={st} /> : null}</div>
                      <div style={{ color: "var(--muted-line)", textAlign: "right" }}>›</div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
