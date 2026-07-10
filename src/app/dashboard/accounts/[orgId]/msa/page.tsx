/**
 * MSA document — the account-level umbrella contract, boilerplate (docs/MSA.docx
 * v1.0 → src/domain/msa.ts) auto-populated from live account data. Reached from
 * the deal's agreement package (MSA row seeds at Committed) and the Account
 * page's Agreements rail. Staff only; print-ready.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { msaViewFor } from "@/services/agreements";
import { msaMarkdown, MSA_TEMPLATE_VERSION } from "@/domain/msa";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { MsaDoc } from "@/components/MsaDoc";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function MsaPage({ params }: { params: Promise<{ orgId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { orgId } = await params;
  const view = await msaViewFor(ctx, orgId);
  if (!view) notFound();

  // Signed → the executed date anchors the document; otherwise today (send-ready).
  const effectiveDate = fmtDate(view.signedAt ?? new Date());
  const md = msaMarkdown({
    clientName: view.orgName,
    effectiveDate,
    wahalaRepName: view.wahalaRepName,
    clientRepName: view.clientRepName,
    clientRepTitle: view.clientRepTitle,
  });

  return (
    <AppShell
      active="accounts"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      wide
    >
      <div className="mono no-print" style={{ fontSize: 11, color: "var(--muted-line)", marginBottom: 14 }}>
        <Link href="/dashboard/accounts" style={{ color: "inherit" }}>Accounts</Link> /{" "}
        <Link href={`/dashboard/accounts/${orgId}`} style={{ color: "inherit" }}>{view.orgName}</Link> / MSA
      </div>
      <MsaDoc
        md={md}
        status={view.status}
        signedNote={view.signedAt ? `signed ${fmtDate(view.signedAt)}` : null}
        templateVersion={MSA_TEMPLATE_VERSION}
      />
    </AppShell>
  );
}
