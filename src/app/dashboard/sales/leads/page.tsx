/**
 * All leads — the leads subsection of Sales: every lead ever trapped (new,
 * qualified, passed), each linking to its workspace (dump + AI scout). Staff only.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listLeads, type LeadItem } from "@/services/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const GROUPS: { status: LeadItem["status"]; label: string }[] = [
  { status: "new", label: "To qualify" },
  { status: "qualified", label: "Qualified" },
  { status: "disqualified", label: "Passed" },
];

const VERDICT_COLORS: Record<string, { bg: string; color: string }> = {
  pursue: { bg: "#e8f7ee", color: "#15803d" },
  probe: { bg: "#fff7ed", color: "#b45309" },
  pass: { bg: "#fdeeee", color: "#b91c1c" },
};

export default async function LeadsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const leads = await listLeads(ctx);

  return (
    <AppShell
      active="sales"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
        <Link href="/dashboard/sales">Sales</Link> / Leads
      </div>
      <h1 style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Leads</h1>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
        Every lead ever trapped. Open one to dump material on it and run the scout.
      </p>

      {GROUPS.map((g) => {
        const rows = leads.filter((l) => l.status === g.status);
        return (
          <section key={g.status} style={{ marginTop: 26 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>
              {g.label} ({rows.length})
            </div>
            {rows.length === 0 ? (
              <p style={{ color: "var(--muted-line)", fontSize: 13, margin: 0 }}>—</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {rows.map((l) => {
                  const v = l.aiVerdict ? VERDICT_COLORS[l.aiVerdict] : null;
                  return (
                    <Link
                      key={l.id}
                      href={`/dashboard/sales/leads/${l.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: "var(--white)",
                        border: "1px solid #ededf1",
                        borderRadius: 10,
                        padding: "11px 14px",
                        textDecoration: "none",
                        color: "inherit",
                        opacity: g.status === "disqualified" ? 0.65 : 1,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 14, flex: "none" }}>{l.name}</span>
                      {l.aiScore !== null && v && (
                        <span className="kicker" style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 5, background: v.bg, color: v.color, flex: "none" }}>
                          {l.aiScore}/10 · {l.aiVerdict?.toUpperCase()}
                        </span>
                      )}
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[l.company, l.industry, l.source && `via ${l.source}`].filter(Boolean).join(" · ") || "no details yet"}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flex: "none" }}>
                        {l.assignedToName ?? "unowned"} · {new Date(l.createdAt).toLocaleDateString()}
                      </span>
                      <span style={{ color: "var(--muted-line)", flex: "none" }}>›</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </AppShell>
  );
}
