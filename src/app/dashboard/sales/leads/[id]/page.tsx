/**
 * Lead workspace (frame 29) — the scout's dossier as a drawer over the board. Single
 * column at 520px: header, qualify/pass row (while new), the dump, the scout report,
 * and the record editor stacked. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getLeadDetail } from "@/services/lead-workspace";
import { listWahalaStaff } from "@/services/clients";
import { scopedDb } from "@/db/scoped";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SalesDrawer } from "@/components/SalesDrawer";
import { LeadRow } from "@/components/SalesBoard";
import { LeadRecordEditor, LeadFilesPanel, LeadScoutPanel } from "@/components/LeadWorkspace";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: "#FFF7ED", color: "#B45309", label: "To qualify" },
  qualified: { bg: "#DCF5E3", color: "#15803D", label: "Qualified" },
  disqualified: { bg: "#F1F2F4", color: "#6B7280", label: "Passed" },
};

export default async function LeadDrawerPage({ params }: { params: Promise<{ id: string }> }) {
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
    <SalesDrawer routeEcho={`sales / lead / ${lead.name}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{lead.name}</h1>
        <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: chip.bg, color: chip.color }}>
          {chip.label}
          {lead.status === "new" && !lead.assignedToName ? " · unowned" : ""}
        </span>
      </div>
      {lead.convertedDealId && (
        <Link href={`/dashboard/sales/deals/${lead.convertedDealId}`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700 }}>
          View the deal →
        </Link>
      )}

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
              aiAnalysisMd: lead.aiAnalysisMd,
              overdue: false,
              createdAt: lead.createdAt,
            }}
            orgs={orgs.map((o) => ({ id: o.id, name: o.name }))}
            staff={staff}
            canManage={canManage}
          />
        </div>
      )}

      {/* The dump, the scout report, then the record — stacked */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
        <LeadFilesPanel
          leadId={lead.id}
          files={lead.files.map((f) => ({ id: f.id, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploaderName: f.uploaderName }))}
          canDelete={canManage}
        />
        <LeadScoutPanel leadId={lead.id} analysisMd={lead.aiAnalysisMd} score={lead.aiScore} verdict={lead.aiVerdict} analyzedAt={lead.aiAnalyzedAt} canRun={canManage} />
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
      </div>
    </SalesDrawer>
  );
}
