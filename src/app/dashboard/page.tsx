/**
 * Dashboard — the caller's projects (tenant-scoped). Staff/owners can create a
 * project here; everyone drills into a project to run its stage lifecycle.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { LOGIN_PATH } from "@/auth/config";
import { CreateProjectForm } from "@/components/CreateProjectForm";

export const dynamic = "force-dynamic";

const wrap: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 24px",
  lineHeight: 1.5,
};

export default async function Dashboard() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const sdb = scopedDb(ctx);
  const projects = await sdb.listProjects();
  const org = await sdb.currentOrganization();
  const canCreateProject = ctx.isAdmin || ctx.user.role === "account_owner";
  const orgs = canCreateProject ? await sdb.listOrganizations() : [];

  return (
    <main style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            style={{ border: "1px solid #ccc", background: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14 }}
          >
            Sign out
          </button>
        </form>
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 14, color: "#666" }}>
        {ctx.user.name} ({ctx.user.email}) · {ctx.isStaff ? "Wahala staff" : "Client"} · role <code>{ctx.user.role}</code>
        {org ? <> · {org.name}</> : ctx.isStaff ? <> · all organizations</> : null}
      </p>

      {canCreateProject && (
        <section style={{ marginTop: 28, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>New project</h2>
          <CreateProjectForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
        </section>
      )}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>
          Projects <span style={{ color: "#999", fontWeight: 400 }}>({projects.length})</span>
        </h2>
        {projects.length === 0 ? (
          <p style={{ color: "#888" }}>No projects yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projects.map((p) => (
              <li key={p.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
                <Link href={`/dashboard/projects/${p.id}`} style={{ fontWeight: 600 }}>
                  {p.name}
                </Link>
                <span style={{ color: "#888", fontSize: 13 }}>
                  {" "}· {p.status}
                  {p.workType ? <> · {p.workType}</> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
