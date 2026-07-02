"use client";

/**
 * Sales funnel (R1 — docs/brain_storming/synthesis.md): lead inbox + stage-grouped
 * open pipeline. Stages are dispositions — the dropdown moves a deal anywhere, no
 * rules — while days-in-stage + stuck flags give the Monday-meeting view ("why does
 * Jason have 20 deals stuck in solution design?").
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Money } from "@/components/Money";
import type { SalesOverview, DealItem, LeadItem } from "@/services/sales";

type StaffOption = { id: string; name: string };

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "business_requirements", label: "Business requirements" },
  { value: "solution_design", label: "Solution design" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "contract", label: "Contract" },
  { value: "won", label: "Won 🎉" },
  { value: "lost", label: "Lost" },
];

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--white)",
  minWidth: 0,
};

async function patch(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return data.message ?? `Request failed (${res.status}).`;
    }
    return null;
  } catch {
    return "Network error — please try again.";
  }
}

// ---------------------------------------------------------------- lead capture

function LeadCaptureForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", source: "", notes: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setForm({ name: "", company: "", phone: "", email: "", source: "", notes: "" });
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input style={{ ...inputStyle, flex: "1 1 130px" }} placeholder="Name *" value={form.name} onChange={set("name")} required />
      <input style={{ ...inputStyle, flex: "1 1 130px" }} placeholder="Company" value={form.company} onChange={set("company")} />
      <input style={{ ...inputStyle, flex: "1 1 110px" }} placeholder="Phone" value={form.phone} onChange={set("phone")} />
      <input style={{ ...inputStyle, flex: "1 1 150px" }} placeholder="Email" value={form.email} onChange={set("email")} />
      <input style={{ ...inputStyle, flex: "1 1 110px" }} placeholder="Source (airport bar…)" value={form.source} onChange={set("source")} />
      <button
        type="submit"
        disabled={busy || !form.name.trim()}
        style={{
          background: "var(--ink)",
          color: "var(--white)",
          border: "none",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 13.5,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Adding…" : "+ Add lead"}
      </button>
      {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
    </form>
  );
}

// ---------------------------------------------------------------- lead inbox row

export function LeadRow({
  lead,
  orgs,
  staff,
  canManage,
}: {
  lead: LeadItem;
  orgs: { id: string; name: string }[];
  staff: StaffOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealName, setDealName] = useState("");
  const [value, setValue] = useState("");
  const [orgId, setOrgId] = useState("");

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const err = await patch(`/api/leads/${lead.id}`, body);
    if (err) setError(err);
    else router.refresh();
    setBusy(false);
  }

  const detail = [lead.company, lead.phone, lead.email, lead.source && `via ${lead.source}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ background: "#fffdf5", border: "1px solid #f0e6c8", borderRadius: 11, padding: "11px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <Link href={`/dashboard/sales/leads/${lead.id}`} style={{ fontWeight: 700, fontSize: 14.5, color: "inherit", textDecoration: "none" }}>
            {lead.name} <span style={{ color: "var(--muted-line)" }}>›</span>
          </Link>
          {lead.aiScore !== null && (
            <span
              className="kicker"
              style={{
                fontSize: 9,
                marginLeft: 8,
                padding: "2px 7px",
                borderRadius: 5,
                background: lead.aiVerdict === "pursue" ? "#e8f7ee" : lead.aiVerdict === "pass" ? "#fdeeee" : "#fff7ed",
                color: lead.aiVerdict === "pursue" ? "#15803d" : lead.aiVerdict === "pass" ? "#b91c1c" : "#b45309",
              }}
            >
              {lead.aiScore}/10
            </span>
          )}
          {detail && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 10 }}>
              {detail}
            </span>
          )}
        </div>
        {/* Handoff: any staff can claim a lead or hand it to someone ("Josh, you two speak RME"). */}
        <select
          value={lead.assignedToUserId ?? ""}
          disabled={busy}
          onChange={(e) => act({ action: "assign", assignedToUserId: e.target.value || null })}
          style={{ ...inputStyle, flex: "none", fontSize: 12.5, padding: "6px 8px" }}
          title="Who's working this lead"
        >
          <option value="">Unowned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {canManage && (
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <button
              onClick={() => setOpen((v) => !v)}
              disabled={busy}
              style={{
                background: open ? "var(--surface-soft)" : "var(--ink)",
                color: open ? "var(--ink)" : "var(--white)",
                border: "1px solid transparent",
                borderRadius: 8,
                padding: "7px 13px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {open ? "Cancel" : "Qualify"}
            </button>
            <button
              onClick={() => act({ action: "disqualify" })}
              disabled={busy}
              style={{
                background: "var(--white)",
                color: "#b91c1c",
                border: "1px solid #f0caca",
                borderRadius: 8,
                padding: "7px 13px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Pass
            </button>
          </div>
        )}
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <select style={{ ...inputStyle, flex: "1 1 170px" }} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            <option value="">{lead.company ? `New company: ${lead.company}` : "Pick an existing client…"}</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            style={{ ...inputStyle, flex: "2 1 180px" }}
            placeholder="Deal name (optional)"
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: "1 1 100px" }}
            placeholder="Est. value $"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <button
            onClick={() =>
              act({
                action: "qualify",
                organizationId: orgId || undefined,
                dealName: dealName || undefined,
                valueCents: value ? Math.round(parseFloat(value) * 100) : undefined,
              })
            }
            disabled={busy}
            style={{
              background: "#16a34a",
              color: "var(--white)",
              border: "none",
              borderRadius: 8,
              padding: "8px 15px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {busy ? "Working…" : "Create deal →"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- deal row

function DealRow({ deal, canManage }: { deal: DealItem; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(stage: string) {
    setBusy(true);
    setError(null);
    const err = await patch(`/api/deals/${deal.id}`, { stage });
    if (err) setError(err);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "var(--white)",
        border: `1px solid ${deal.stuck ? "#fadcb4" : "#ededf1"}`,
        borderRadius: 11,
        padding: "11px 14px",
      }}
    >
      <div style={{ flex: 1, minWidth: 170 }}>
        <Link href={`/dashboard/sales/deals/${deal.id}`} style={{ fontWeight: 700, fontSize: 14.5, color: "inherit", textDecoration: "none" }}>
          {deal.name} <span style={{ color: "var(--muted-line)" }}>›</span>
        </Link>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
          {deal.organizationName}
          {deal.contactName ? ` · ${deal.contactName}` : ""}
          {deal.ownerName ? ` · owner ${deal.ownerName}` : ""}
        </div>
      </div>
      {deal.valueCents > 0 && <Money cents={deal.valueCents} style={{ fontWeight: 700, fontSize: 14, flex: "none" }} />}
      <span
        className="kicker"
        style={{
          flex: "none",
          fontSize: 10,
          padding: "3px 8px",
          borderRadius: 6,
          background: deal.stuck ? "#fff7ed" : "var(--surface-soft)",
          color: deal.stuck ? "#b45309" : "var(--muted)",
        }}
        title={deal.stuck ? "In this stage 14+ days — worth a look at Monday's meeting" : undefined}
      >
        {deal.stuck ? "⚠ " : ""}
        {deal.daysInStage}d in stage
      </span>
      {canManage ? (
        <select
          value={deal.stage}
          disabled={busy}
          onChange={(e) => move(e.target.value)}
          style={{ ...inputStyle, flex: "none", fontWeight: 600 }}
        >
          {STAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: 0, width: "100%" }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- board

export function SalesBoard({
  overview,
  orgs,
  staff,
  canManage,
}: {
  overview: SalesOverview;
  orgs: { id: string; name: string }[];
  staff: StaffOption[];
  canManage: boolean;
}) {
  const newLeads = overview.leads.filter((l) => l.status === "new");
  const openDealCount = overview.columns.reduce((n, c) => n + c.deals.length, 0);

  return (
    <div>
      {/* Stat strip */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        {[
          { label: "Open pipeline", value: <Money cents={overview.openPipelineCents} /> },
          { label: "Open deals", value: openDealCount },
          { label: "Stuck (14d+)", value: overview.stuckCount },
          { label: "Won / lost", value: `${overview.wonDeals.length} / ${overview.lostCount}` },
        ].map((s) => (
          <div
            key={s.label}
            style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", minWidth: 130 }}
          >
            <div className="kicker">{s.label}</div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", marginTop: 3 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Lead inbox */}
      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <span className="kicker">Leads ({newLeads.length} to qualify)</span>
          <Link href="/dashboard/sales/leads" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--cobalt-text)", textDecoration: "none" }}>
            All leads →
          </Link>
        </div>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <LeadCaptureForm />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            A lead needs nothing but a name — trap it now, qualify it later.
          </p>
        </div>
        {newLeads.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Inbox zero — every lead is qualified or passed.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {newLeads.map((l) => (
              <LeadRow key={l.id} lead={l} orgs={orgs} staff={staff} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      {/* Pipeline */}
      <section style={{ marginTop: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Pipeline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {overview.columns.map((col) => (
            <div key={col.stage}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em" }}>{col.label}</span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {col.deals.length} {col.deals.length === 1 ? "deal" : "deals"}
                </span>
                {col.probabilityPct !== null && col.toward && (
                  <span
                    className="kicker"
                    style={{ fontSize: 9.5, background: "var(--surface-soft)", color: "var(--muted)", padding: "2px 7px", borderRadius: 5 }}
                    title="Win-probability anchor — the odds a deal here reaches the proposal"
                  >
                    ≈{col.probabilityPct}% → {col.toward}
                  </span>
                )}
              </div>
              {col.deals.length === 0 ? (
                <p style={{ color: "var(--muted-line)", fontSize: 13, margin: "0 0 2px" }}>—</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {col.deals.map((d) => (
                    <DealRow key={d.id} deal={d} canManage={canManage} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Won */}
      {overview.wonDeals.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            Won ({overview.wonDeals.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {overview.wonDeals.map((d) => (
              <DealRow key={d.id} deal={d} canManage={canManage} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
