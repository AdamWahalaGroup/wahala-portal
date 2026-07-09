/**
 * Contact workspace (frames 29/31) — the scout's dossier as a drawer over the board.
 * Single column at 520px: header (state chip), qualify/pass row (while to_qualify),
 * the dump, the scout report, and the record editor stacked. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getContactDetail } from "@/services/contact-workspace";
import { listWahalaStaff } from "@/services/clients";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SalesDrawer } from "@/components/SalesDrawer";
import { StartOpportunityButton } from "@/components/OpportunityModals";
import { ContactRecordEditor, ContactFilesPanel, ContactScoutPanel } from "@/components/ContactWorkspace";
import { DangerDeleteButton } from "@/components/DangerDeleteButton";

export const dynamic = "force-dynamic";

const STATE_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  to_qualify: { bg: "#FFF7ED", color: "#B45309", label: "To qualify" },
  qualified: { bg: "#DCF5E3", color: "#15803D", label: "Qualified" },
  passed: { bg: "#F1F2F4", color: "#6B7280", label: "Passed" },
};

export default async function ContactDrawerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const contact = await getContactDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const staff = await listWahalaStaff(ctx);
  const chip = STATE_CHIP[contact.state];

  return (
    <SalesDrawer routeEcho={`sales / contact / ${contact.name}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{contact.name}</h1>
        <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: chip.bg, color: chip.color }}>
          {chip.label}
          {contact.state === "to_qualify" && !contact.assignedToName ? " · unowned" : ""}
        </span>
        {ctx.isAdmin && (
          <DangerDeleteButton
            endpoint={`/api/contacts/${contact.id}`}
            title={`Delete ${contact.name}?`}
            body="Removes the contact record, its files, and account links. Deals keep their history but lose the contact link. This can't be undone."
            redirectTo="/dashboard/sales"
          />
        )}
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)", marginTop: 4 }}>
        one record forever — lead is a state, not a thing
      </div>
      {/* Everything captured, visible (QA delta 07-08 §1): est · owner · source */}
      {(contact.estValueCents > 0 || contact.assignedToName || contact.source) && (
        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
          {contact.estValueCents > 0 && (
            <span className="tabular" style={{ fontWeight: 800, color: "var(--ink)" }}>${Math.round(contact.estValueCents / 100).toLocaleString("en-US")} est</span>
          )}
          {contact.estValueCents > 0 && (contact.assignedToName || contact.source) ? " · " : ""}
          {contact.assignedToName ? `owner ${contact.assignedToName}` : ""}
          {contact.assignedToName && contact.source ? " · " : ""}
          {contact.source ? `via ${contact.source}` : ""}
        </div>
      )}
      {contact.notes && (
        <div style={{ background: "#fffdf5", border: "1px solid #f0e6c8", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8, fontStyle: "italic" }}>
          &ldquo;{contact.notes}&rdquo;
        </div>
      )}
      {contact.linkedDealId && (
        <Link href={`/dashboard/sales/deals/${contact.linkedDealId}`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700 }}>
          View the deal →
        </Link>
      )}
      {contact.organizationId && (
        <Link href={`/dashboard/accounts/${contact.organizationId}`} style={{ display: "inline-block", marginTop: 8, marginLeft: contact.linkedDealId ? 14 : 0, fontSize: 13, fontWeight: 700 }}>
          {contact.organizationName ?? "Account"} →
        </Link>
      )}

      {/* People first: a contact stands alone — start an opportunity from it any time. */}
      {!contact.linkedDealId && (
        <div style={{ marginTop: 16 }}>
          <StartOpportunityButton
            contact={{ id: contact.id, name: contact.name, organizationId: contact.organizationId, organizationName: contact.organizationName }}
            currentUserId={ctx.user.id}
          />
        </div>
      )}

      {/* The dump, the scout report, then the record — stacked */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
        <ContactFilesPanel
          contactId={contact.id}
          files={contact.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploaderName: f.uploaderName }))}
          canDelete={canManage}
        />
        <ContactScoutPanel contactId={contact.id} analysisMd={contact.aiAnalysisMd} score={contact.aiScore} verdict={contact.aiVerdict} analyzedAt={contact.aiAnalyzedAt} canRun={canManage} />
        <ContactRecordEditor
          contactId={contact.id}
          initial={{
            name: contact.name,
            companyNote: contact.companyNote ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            source: contact.source ?? "",
            notes: contact.notes ?? "",
          }}
          editable={contact.state === "to_qualify" || canManage}
        />
      </div>
    </SalesDrawer>
  );
}
