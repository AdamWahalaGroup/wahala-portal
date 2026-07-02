/**
 * Lead workspace (frame 23) — the scout's dossier. Slim breadcrumb chrome for
 * content width; the dump + scout report lead in the main column (~2/3), the
 * record fields sit compact in the right rail. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getLeadDetail } from "@/services/lead-workspace";
import { listWahalaStaff } from "@/services/clients";
import { scopedDb } from "@/db/scoped";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { SlimShell } from "@/components/SlimShell";
import { LeadRow } from "@/components/SalesBoard";
import { LeadRecordEditor, LeadFilesPanel, LeadScoutPanel } from "@/components/LeadWorkspace";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: "#FFF7ED", color: "#B45309", label: "To qualify" },
  qualified: { bg: "#DCF5E3", color: "#15803D", label: "Qualified" },
  disqualified: { bg: "#F1F2F4", color: "#6B7280", label: "Passed" },
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
    <SlimShell
      crumbs={[
        { label: "Sales", href: "/dashboard/sales" },
        { label: "Leads", href: "/dashboard/sales/leads" },
        { label: lead.name },
      ]}
      user={{ name: ctx.user.name, role: ctx.user.role }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{lead.name}</h1>
        <span className="kicker" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, background: chip.bg, color: chip.color }}>
          {chip.label}
          {lead.status === "new" && !lead.assignedToName ? " · unowned" : ""}
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

      {/* Dossier: dump + scout lead; the record sits in the rail */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)", gap: 28, marginTop: 22, alignItems: "start" }}>
        <div>
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
        </div>
        <aside>
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
        </aside>
      </div>
    </SlimShell>
  );
}
