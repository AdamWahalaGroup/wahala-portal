/**
 * Project detail — its stages (tenant-scoped) and, for staff/owners, a form to
 * add a new draft stage. Each stage links to its lifecycle page.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { LOGIN_PATH } from "@/auth/config";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateStageForm } from "@/components/CreateStageForm";
import { formatCents } from "@/lib/format";

export const dynamic = "force-dynamic";

const wrap: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 24px",
  lineHeight: 1.5,
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const sdb = scopedDb(ctx);
  const project = await sdb.getProject(id);
  if (!project) notFound();

  const stages = await sdb.listStages(id);
  const canCreateStage = ctx.isStaff && (ctx.isAdmin || ctx.user.role === "account_owner");

  return (
    <main style={wrap}>
      <Link href="/dashboard" style={{ fontSize: 14 }}>
        ← Dashboard
      </Link>

      <h1 style={{ margin: "10px 0 2px" }}>{project.name}</h1>
      <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
        {project.status}
        {project.workType ? <> · {project.workType}</> : null}
      </p>
      {project.description && <p style={{ color: "#444" }}>{project.description}</p>}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>
          Stages <span style={{ color: "#999", fontWeight: 400 }}>({stages.length})</span>
        </h2>
        {stages.length === 0 ? (
          <p style={{ color: "#888" }}>No stages yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {stages.map((s) => (
              <li
                key={s.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #eee", padding: "10px 0", gap: 12 }}
              >
                <Link href={`/dashboard/stages/${s.id}`} style={{ fontWeight: 600 }}>
                  {s.name}
                </Link>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: "#444", fontSize: 14 }}>{formatCents(s.totalAmountCents)}</span>
                  <StatusBadge status={s.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canCreateStage && (
        <section style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>New stage</h2>
          <CreateStageForm projectId={project.id} />
        </section>
      )}
    </main>
  );
}
