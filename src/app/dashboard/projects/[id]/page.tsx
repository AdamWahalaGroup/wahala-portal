/**
 * Project detail — people (owner / lead / roster) + the numbered stage list.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { getProjectDetail } from "@/services/projects";
import { listFilesForProject } from "@/services/files";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Money } from "@/components/Money";
import { PeopleCard, Avatar } from "@/components/People";
import { CreateStageForm } from "@/components/CreateStageForm";
import { FilesClient } from "@/components/FilesClient";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const detail = await getProjectDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const sdb = scopedDb(ctx);
  const [stages, accountOwner, files] = await Promise.all([
    sdb.listStages(id),
    sdb.accountOwner(),
    listFilesForProject(ctx, id),
  ]);

  const { project } = detail;
  const activeStageId = stages.find((s) => s.status !== "accepted" && s.status !== "rejected")?.id;
  const canCreateStage = ctx.isStaff && (ctx.isAdmin || ctx.user.role === "account_owner");

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={detail.organizationName}
      accountOwner={ctx.isStaff ? null : accountOwner}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard">Projects</Link> / {project.name}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{project.name}</h1>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-soft)",
            background: "var(--surface)",
            borderRadius: 999,
            padding: "4px 11px",
            textTransform: "capitalize",
          }}
        >
          {project.status}
        </span>
      </div>
      {project.description && <p style={{ margin: "8px 0 0", color: "var(--ink-soft)", fontSize: 14.5 }}>{project.description}</p>}
      {project.workType && (
        <div className="kicker" style={{ marginTop: 10 }}>
          Work type · {project.workType}
        </div>
      )}

      {/* People */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 22, alignItems: "center" }}>
        {detail.accountOwner && <PeopleCard name={detail.accountOwner.name} role="Account owner" variant="owner" />}
        {detail.leadEngineer && <PeopleCard name={detail.leadEngineer.name} role="Lead engineer" variant="lead" />}
        {detail.roster.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="kicker">Roster</div>
            <div style={{ display: "flex" }}>
              {detail.roster.map((m, i) => (
                <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--white)", borderRadius: "50%" }}>
                  <Avatar name={m.name} size={30} />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stages */}
      <section style={{ marginTop: 30 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Stages ({stages.length})
        </div>
        {stages.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No stages yet.</p>
        ) : (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {stages.map((s, i) => {
              const active = s.id === activeStageId;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/stages/${s.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 1fr auto auto 16px",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                    textDecoration: "none",
                    color: "inherit",
                    ...(active ? { background: "#f3f5ff", boxShadow: "inset 2px 0 0 var(--cobalt)" } : {}),
                  }}
                >
                  <span className="mono" style={{ fontSize: 13, color: "var(--muted-line)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                    {s.scopeDescription && (
                      <div className="kicker" style={{ marginTop: 2, textTransform: "none", letterSpacing: 0, fontSize: 12, color: "var(--muted)" }}>
                        {s.scopeDescription}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={s.status} />
                  <Money cents={s.totalAmountCents} style={{ fontWeight: 700, fontSize: 15 }} />
                  <span style={{ color: "var(--muted-line)", textAlign: "right" }}>›</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Files */}
      <section style={{ marginTop: 30 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Files ({files.length})
        </div>
        <FilesClient files={files} projectId={project.id} canManage={ctx.isStaff} />
      </section>

      {canCreateStage && (
        <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            New stage
          </div>
          <CreateStageForm projectId={project.id} />
        </section>
      )}
    </AppShell>
  );
}
