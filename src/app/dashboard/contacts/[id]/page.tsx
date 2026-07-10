/**
 * Contact detail — full-width page under the Contacts nav (Interactive v3 →
 * Contacts detail screen; founder screenshot 09 Jul). People first: dossier on
 * the left (details / portal access / company), opportunities on the right,
 * "+ Start opportunity" always available. The dump + AI scout report live here
 * too (10 Jul merge — the old drawer workspace at /dashboard/sales/contacts/[id]
 * now redirects here). One page per person. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getContactDetail } from "@/services/contact-workspace";
import { StageError } from "@/domain/stage-machine";
import { STAGE_META } from "@/domain/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/People";
import { StartOpportunityButton } from "@/components/OpportunityModals";
import { ContactDetailsCard, PortalAccessCard, CompanyCard } from "@/components/ContactDetailCards";
import { ContactFilesPanel, ContactScoutPanel } from "@/components/ContactWorkspace";
import { DangerDeleteButton } from "@/components/DangerDeleteButton";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const contact = await getContactDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";

  const sub = [
    contact.source ? `via ${contact.source}` : null,
    contact.portal === "invited" ? "✉ invited to the portal" : contact.portal === "active" ? "✉ on the portal" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      active="contacts"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div style={{ maxWidth: 1080 }}>
        {/* People-first motto strip (prototype chrome) */}
        <div className="mono" style={{ background: "var(--ink)", color: "#9aa0aa", borderRadius: 8, padding: "6px 14px", fontSize: 10, letterSpacing: ".04em", textAlign: "center" }}>
          people first — a contact can stand alone; an account always hangs off at least one contact
        </div>

        <Link href="/dashboard/contacts" className="mono" style={{ display: "inline-block", marginTop: 18, fontSize: 11, fontWeight: 700, color: "var(--muted)", textDecoration: "none" }}>
          ← Contacts
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          <Avatar name={contact.name} size={48} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>{contact.name}</h1>
              {contact.organizationName && <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{contact.organizationName}</span>}
            </div>
            {sub && (
              <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)", marginTop: 4 }}>{sub}</div>
            )}
            {contact.notes && (
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, fontStyle: "italic" }}>&ldquo;{contact.notes}&rdquo;</div>
            )}
          </div>
          {ctx.isAdmin && (
            <DangerDeleteButton
              endpoint={`/api/contacts/${contact.id}`}
              title={`Delete ${contact.name}?`}
              body="Removes the contact record, its files, and account links. Deals keep their history but lose the contact link. This can't be undone."
              redirectTo="/dashboard/contacts"
            />
          )}
          <StartOpportunityButton
            contact={{ id: contact.id, name: contact.name, organizationId: contact.organizationId, organizationName: contact.organizationName }}
            currentUserId={ctx.user.id}
          />
        </div>

        {/* Two-column body: dossier left, opportunities right */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.05fr)", gap: 22, marginTop: 22, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <ContactDetailsCard
              contactId={contact.id}
              initial={{ name: contact.name, email: contact.email ?? "", title: contact.title ?? "", source: contact.source ?? "" }}
              editable={canManage}
            />
            <PortalAccessCard
              email={contact.email}
              organizationId={contact.organizationId}
              contactId={contact.id}
              portal={contact.portal}
              canManage={canManage}
            />
            <CompanyCard
              contactId={contact.id}
              organizationId={contact.organizationId}
              organizationName={contact.organizationName}
              organizationStatus={contact.organizationStatus}
              canManage={canManage}
            />
          </div>

          <section style={{ background: "var(--white)", border: "1px solid #EDEDF1", borderRadius: 12, padding: "16px 18px" }}>
            <div className="kicker" style={{ marginBottom: 12 }}>Opportunities</div>
            {contact.opportunities.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>None yet — every opportunity starts from a contact.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {contact.opportunities.map((o) => {
                  const stageLabel = (STAGE_META as Record<string, { label: string }>)[o.stage]?.label ?? o.stage;
                  const terminal = o.stage === "won" || o.stage === "lost";
                  return (
                    <Link
                      key={o.id}
                      href={`/dashboard/sales/deals/${o.id}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", textDecoration: "none", color: "inherit" }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 2, flex: "none", background: o.stage === "won" ? "#16A34A" : o.stage === "lost" ? "#B91C1C" : "var(--cobalt)" }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {o.name}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: terminal ? (o.stage === "won" ? "#15803D" : "#B91C1C") : "var(--muted)", flex: "none" }}>
                        {stageLabel}
                        {o.valueCents > 0 ? ` · $${Math.round(o.valueCents / 100).toLocaleString("en-US")}` : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* The dump + the scout report (merged from the old board-drawer workspace, 10 Jul) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 22 }}>
          <ContactScoutPanel
            contactId={contact.id}
            analysisMd={contact.aiAnalysisMd}
            score={contact.aiScore}
            verdict={contact.aiVerdict}
            analyzedAt={contact.aiAnalyzedAt}
            canRun={canManage}
          />
          <ContactFilesPanel
            contactId={contact.id}
            files={contact.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploaderName: f.uploaderName }))}
            canDelete={canManage}
          />
        </div>
      </div>
    </AppShell>
  );
}
