/**
 * Protected dashboard. Proves the auth + scoped-query stack end-to-end:
 *  - getAuthContext() gates the page (redirect to /login if not signed in).
 *  - scopedDb(ctx) reads projects/tasks through the tenant + visibility seam,
 *    so a client sees only their org's data and only client-visible rows.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { scopedDb } from "@/db/scoped";
import { LOGIN_PATH } from "@/auth/config";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const sdb = scopedDb(ctx);
  const org = await sdb.currentOrganization();
  const projects = await sdb.listProjects();

  // Show tasks for the first project, to demonstrate visibility filtering.
  const firstProject = projects[0];
  const tasks = firstProject ? await sdb.listTasks(firstProject.id) : [];

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            style={{
              border: "1px solid #ccc",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Sign out
          </button>
        </form>
      </div>

      <section style={{ marginTop: 16, color: "#444" }}>
        <p style={{ margin: "4px 0" }}>
          Signed in as <strong>{ctx.user.name}</strong> ({ctx.user.email})
        </p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "#666" }}>
          {ctx.isStaff ? "Wahala staff" : "Client"} · role{" "}
          <code>{ctx.user.role}</code>
          {org ? (
            <>
              {" "}
              · org <strong>{org.name}</strong>
            </>
          ) : ctx.isStaff ? (
            <> · all organizations</>
          ) : null}
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>
          Projects{" "}
          <span style={{ color: "#999", fontWeight: 400 }}>
            ({projects.length})
          </span>
        </h2>
        {projects.length === 0 ? (
          <p style={{ color: "#888" }}>No projects visible to you.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {projects.map((p) => (
              <li key={p.id} style={{ marginBottom: 4 }}>
                <strong>{p.name}</strong>{" "}
                <span style={{ color: "#888", fontSize: 13 }}>
                  · {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {firstProject && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>
            Tasks in “{firstProject.name}”{" "}
            <span style={{ color: "#999", fontWeight: 400 }}>
              ({tasks.length})
            </span>
          </h2>
          <p style={{ color: "#888", fontSize: 13, marginTop: 0 }}>
            {ctx.canSeeInternal
              ? "You see internal-flagged tasks too."
              : "Internal-flagged tasks are hidden from you."}
          </p>
          <ul style={{ paddingLeft: 18 }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}>
                {t.title}{" "}
                <span style={{ color: "#888", fontSize: 13 }}>
                  · {t.status} · {t.visibility}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
