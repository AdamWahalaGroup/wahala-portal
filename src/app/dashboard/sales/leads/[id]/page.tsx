/**
 * Lead workspace — one lead's home: the editable record, the unorganized dump
 * (files/photos/anything), and the AI scout report (web recon + opinion + 1–10
 * effort score). Qualify/pass/assign actions included while the lead is new.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getLeadDetail } from "@/services/lead-workspace";
import { listWahalaStaff } from "@/services/clients";
import { scopedDb } from "@/db/scoped";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { LeadRow } from "@/components/SalesBoard";
import { LeadRecordEditor, LeadFilesPanel, LeadScoutPanel } from "@/components/LeadWorkspace";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: "#fffdf5", color: "#b45309", label: "To qualify" },
  qualified: { bg: "#e8f7ee", color: "#15803d", label: "Qualified" },
  disqualified: { bg: "var(--surface-soft)", color: "var(--muted)", label: "Passed" },
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { id } = await params;
  const lead = await getLeadDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const [staff, orgs] = await Promise.all([
    listWahalaStaff(ctx),
    lead.status === "new" && canManage ? scopedDb(ctx).listOrganizations() : Promise.resolve([]),
  ]);
  const chip = STATUS_CHIP[lead.status];

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard/sales">Sales</Link> / <Link href="/dashboard/sales/leads">Leads</Link> / {lead.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{lead.name}</h1>
        <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: chip.bg, color: chip.color }}>
          {chip.label}
        </span>
        {lead.convertedDealId && (
          <Link href={`/dashboard/sales/deals/${lead.convertedDealId}`} style={{ fontSize: 13, fontWeight: 700 }}>
            View the deal →
          </Link>
        )}
      </div>

      {/* Qualify / pass / assign while the lead is still open */}
      {lead.status === "new" && (
        <div style={{ marginTop: 16 }}>
          <LeadRow
            lead={{
              id: lead.id,
              name: lead.name,
              company: lead.company,
              email: lead.email,
              phone: lead.phone,
              source: lead.source,
              industry: lead.industry,
              notes: lead.notes,
              status: lead.status,
              assignedToUserId: lead.assignedToUserId,
              assignedToName: lead.assignedToName,
              aiScore: lead.aiScore,
              aiVerdict: lead.aiVerdict,
              createdAt: lead.createdAt,
            }}
            orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
            staff={staff}
            canManage={canManage}
          />
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Record</div>
        <LeadRecordEditor
          leadId={lead.id}
          initial={{
            name: lead.name,
            company: lead.company ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            source: lead.source ?? "",
            industry: lead.industry ?? "",
            notes: lead.notes ?? "",
          }}
          editable={lead.status === "new" || canManage}
        />
      </section>

      <LeadFilesPanel
        leadId={lead.id}
        files={lead.files.map((f) => ({
          id: f.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          uploaderName: f.uploaderName,
        }))}
        canDelete={canManage}
      />

      <LeadScoutPanel
        leadId={lead.id}
        analysisMd={lead.aiAnalysisMd}
        score={lead.aiScore}
        verdict={lead.aiVerdict}
        analyzedAt={lead.aiAnalyzedAt}
        canRun={canManage}
      />
    </AppShell>
  );
}
