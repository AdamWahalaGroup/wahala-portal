/**
 * Leads list (frame 22) — score-first triage. Quick-capture lives here (a name is
 * enough); To-qualify rows anchor on the big score/verdict block; qualified rows go
 * muted and link onward to their deal. Staff only.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listLeads, type LeadItem } from "@/services/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { SalesTabs } from "@/components/SalesTabs";
import { ScoreChip } from "@/components/SalesChips";
import { LeadCaptureForm } from "@/components/SalesBoard";

export const dynamic = "force-dynamic";

function LeadLine({ lead, muted }: { lead: LeadItem; muted?: boolean }) {
  const detail = [lead.company, lead.industry, lead.source && `via ${lead.source}`].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/dashboard/sales/leads/${lead.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--white)",
        border: "1px solid #ededf1",
        borderRadius: 11,
        padding: "12px 14px",
        textDecoration: "none",
        color: "inherit",
        opacity: muted ? 0.65 : 1,
      }}
    >
      {/* The score block is the visual anchor */}
      <div style={{ flex: "none", minWidth: 118 }}>
        {lead.aiScore !== null ? (
          <ScoreChip score={lead.aiScore} verdict={lead.aiVerdict} size="lg" />
        ) : (
          <span className="kicker" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, padding: "6px 12px", borderRadius: 999, background: "#F1F2F4", color: "#6B7280" }}>
            not scored · ◆
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{lead.name}</div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {detail || "no details yet"}
        </div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flex: "none" }}>
        {lead.assignedToName ?? "unowned"} · {new Date(lead.createdAt).toLocaleDateString()}
      </span>
      <span style={{ color: "var(--muted-line)", flex: "none" }}>›</span>
    </Link>
  );
}

export default async function LeadsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const leads = await listLeads(ctx);
  const toQualify = leads.filter((l) => l.status === "new");
  const qualified = leads.filter((l) => l.status === "qualified");
  const passed = leads.filter((l) => l.status === "disqualified");

  return (
    <AppShell
      active="sales-leads"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      leadCount={toQualify.length}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
            <Link href="/dashboard/sales">Sales</Link> / Leads
          </div>
          <h1 style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Leads</h1>
        </div>
        <SalesTabs active="leads" />
      </div>

      {/* Quick capture — a name is enough, trap it now */}
      <div style={{ marginTop: 20, background: "var(--cobalt-wash)", border: "2px dashed var(--cobalt-wash-border)", borderRadius: 14, padding: 16 }}>
        <div className="kicker" style={{ color: "var(--cobalt-text)", marginBottom: 10 }}>
          Quick capture — trap it now, qualify it later
        </div>
        <LeadCaptureForm />
      </div>

      {/* Count strip */}
      <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
        {[
          { label: "To qualify", n: toQualify.length, hot: true },
          { label: "Qualified", n: qualified.length, hot: false },
          { label: "Passed", n: passed.length, hot: false },
        ].map((t) => (
          <span key={t.label} className="kicker" style={{ fontSize: 10.5, padding: "5px 12px", borderRadius: 999, background: t.hot && t.n > 0 ? "#FFF7ED" : "var(--surface)", color: t.hot && t.n > 0 ? "#B45309" : "var(--muted)" }}>
            {t.label} · {t.n}
          </span>
        ))}
      </div>

      <section style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <span className="kicker">To qualify ({toQualify.length})</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)", fontStyle: "italic" }}>
            same items as the Board&apos;s Triage column — Qualify ≡ drag right into Discovery
          </span>
        </div>
        {toQualify.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Inbox zero.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {toQualify.map((l) => (
              <LeadLine key={l.id} lead={l} />
            ))}
          </div>
        )}
      </section>

      {qualified.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Qualified ({qualified.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {qualified.map((l) => (
              <LeadLine key={l.id} lead={l} muted />
            ))}
          </div>
        </section>
      )}

      {passed.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Passed ({passed.length})</div>
          <div style={{ display: "grid", gap: 8 }}>
            {passed.map((l) => (
              <LeadLine key={l.id} lead={l} muted />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
