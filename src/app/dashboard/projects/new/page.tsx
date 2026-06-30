/**
 * New project (design frames 18–20). Staff-only:
 *   - default: blank flow (the existing CreateProjectForm — name/work-type/etc.).
 *   - ?ai=1:   AI draft flow (Upload → Analyzing → Review & edit → Create).
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { LOGIN_PATH } from "@/auth/config";
import { scopedDb } from "@/db/scoped";
import { AppShell } from "@/components/AppShell";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { AiDraftFlow } from "@/components/AiDraftFlow";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const sdb = scopedDb(ctx);
  const orgs = await sdb.listOrganizations();
  const sp = await searchParams;
  const isAi = sp.ai === "1";

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      {isAi ? (
        <AiDraftFlow orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      ) : (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="kicker">New project</div>
          <h1 style={{ margin: "6px 0 14px", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>Start a blank project</h1>
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
            <CreateProjectForm orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
