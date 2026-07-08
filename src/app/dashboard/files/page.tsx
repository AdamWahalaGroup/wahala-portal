/**
 * Client Files (QA delta 07-08 §5) — every client nav item routes to a REAL
 * page; the empty state is the accountability pitch (a named human, day zero).
 * Lists client-visible files across the org's projects. Staff → their dashboard.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listClientFiles } from "@/services/files";
import { scopedDb } from "@/db/scoped";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { PeopleCard } from "@/components/People";

export const dynamic = "force-dynamic";

const fmtBytes = (n: number | null) =>
  !n ? "" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

export default async function ClientFilesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (ctx.isStaff) redirect("/dashboard");

  const sdb = scopedDb(ctx);
  const [files, org, accountOwner] = await Promise.all([listClientFiles(ctx), sdb.currentOrganization(), sdb.accountOwner()]);

  return (
    <AppShell
      active="files"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={org?.name ?? null}
      accountOwner={accountOwner}
    >
      <div className="kicker">{org?.name ?? "Files"}</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Files</h1>
      <p style={{ margin: "6px 0 22px", color: "var(--muted)", fontSize: 14.5 }}>
        Everything shared with you, across your projects.
      </p>

      {files.length === 0 ? (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 13, padding: "22px 24px" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
            No files yet — deliverables and documents your team shares will appear here.
          </p>
          {accountOwner && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <PeopleCard name={accountOwner.name} role="Your account owner" variant="owner" />
              <Link
                href="/dashboard/messages"
                style={{ background: "var(--ink)", color: "var(--white)", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, textDecoration: "none", flex: "none" }}
              >
                Message {accountOwner.name.split(" ")[0]}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--white)", border: "1px solid #ededf1", borderRadius: 11, padding: "11px 14px" }}>
              <span className="kicker" style={{ fontSize: 8.5, padding: "3px 7px", borderRadius: 5, background: "var(--surface)", color: "var(--ink-soft)", flex: "none" }}>
                {f.ext || "FILE"}
              </span>
              <a href={`/api/files/${f.id}`} style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
              </a>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", flex: "none" }}>
                {f.projectName ? `${f.projectName} · ` : ""}
                {fmtBytes(f.sizeBytes)}
                {" · "}
                {new Date(f.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
