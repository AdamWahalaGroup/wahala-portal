/**
 * Professional Services Terms document — the standing delivery rulebook riding
 * on the MSA (docs/Wahala_Group_Standard_Professional_Services_Terms.docx v1.0
 * → src/domain/ps-terms.ts), auto-populated from live account data. Reached
 * from the deal's agreement package and the Account page's Agreements rail.
 * Staff only; print-ready.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { agreementDocViewFor } from "@/services/agreements";
import { psTermsMarkdown, PS_TERMS_TEMPLATE_VERSION } from "@/domain/ps-terms";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { MsaDoc } from "@/components/MsaDoc";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function PsTermsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { orgId } = await params;
  const view = await agreementDocViewFor(ctx, orgId, "professional_services");
  if (!view) notFound();

  // Signed → the executed date anchors the document; otherwise today (send-ready).
  const effectiveDate = fmtDate(view.signedAt ?? new Date());
  const md = psTermsMarkdown({
    counterpartyName: view.orgName,
    effectiveDate,
    msaDate: view.msaSignedAt ? fmtDate(view.msaSignedAt) : null,
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
        <Link href={`/dashboard/accounts/${orgId}`} style={{ color: "inherit" }}>{view.orgName}</Link> / professional services terms
      </div>
      <MsaDoc
        kind="professional_services"
        md={md}
        status={view.status}
        signedNote={view.signedAt ? `signed ${fmtDate(view.signedAt)}` : null}
        templateVersion={PS_TERMS_TEMPLATE_VERSION}
      />
    </AppShell>
  );
}
