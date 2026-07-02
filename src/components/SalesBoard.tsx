"use client";

/**
 * Sales home / pipeline board (frame 21) — the Monday-meeting view. Stat cards,
 * the new-leads-to-qualify strip, six stacked stage sections with sums + probability
 * anchors (amber when they hold stuck deals), and the green Won strip. Stages are
 * dispositions: the dropdown moves a deal anywhere, every move is logged.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Money } from "@/components/Money";
import { ScoreChip, DaysTag, STAGE_COLORS, stageSelectStyle } from "@/components/SalesChips";
import type { SalesOverview, DealItem, LeadItem } from "@/services/sales";
import type { DealStage } from "@/domain/sales";

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

// ---------------------------------------------------------------- lead capture (lives on the Leads page)

export function LeadCaptureForm() {
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

// ---------------------------------------------------------------- lead row (qualify / pass / assign)

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
    <div style={{ background: "var(--white)", border: "1px solid #f0e6c8", borderLeft: "3px solid #FADCB4", borderRadius: 11, padding: "11px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <ScoreChip score={lead.aiScore} verdict={lead.aiVerdict} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <Link href={`/dashboard/sales/leads/${lead.id}`} style={{ fontWeight: 700, fontSize: 14.5, color: "inherit", textDecoration: "none" }}>
            {lead.name} <span style={{ color: "var(--muted-line)" }}>›</span>
          </Link>
          {detail && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 10 }}>
              {detail}
            </span>
          )}
        </div>
        <select
          value={lead.assignedToUserId ?? ""}
          disabled={busy}
          onChange={(e) => act({ action: "assign", assignedToUserId: e.target.value || null })}
          style={{ ...stageSelectStyle, flex: "none", fontSize: 12, padding: "6px 8px", fontWeight: 500 }}
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
        padding: "10px 14px",
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
      <DaysTag days={deal.daysInStage} stuck={deal.stuck} />
      {canManage ? (
        <select value={deal.stage} disabled={busy} onChange={(e) => move(e.target.value)} style={{ ...stageSelectStyle, flex: "none" }}>
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
  const wonCents = overview.wonDeals.reduce((n, d) => n + d.valueCents, 0);

  const cardBase: React.CSSProperties = {
    background: "var(--white)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "14px 18px",
    minWidth: 150,
    flex: "1 1 150px",
  };

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <div style={cardBase}>
          <div className="kicker">Open pipeline</div>
          <Money cents={overview.openPipelineCents} style={{ display: "block", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", marginTop: 3 }} />
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            ≈ <Money cents={overview.openWeightedCents} /> weighted
          </div>
        </div>
        <div style={cardBase}>
          <div className="kicker">Open deals</div>
          <div className="tabular" style={{ fontSize: 22, fontWeight: 800, marginTop: 3 }}>{openDealCount}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {newLeads.length} lead{newLeads.length === 1 ? "" : "s"} to qualify
          </div>
        </div>
        <div style={{ ...cardBase, background: "#FFF7ED", border: "1px solid #FADCB4", borderLeft: "4px solid #D97706" }}>
          <div className="kicker" style={{ color: "#B45309" }}>Stuck 14d+</div>
          <div className="tabular" style={{ fontSize: 22, fontWeight: 800, marginTop: 3, color: overview.stuckCount > 0 ? "#B45309" : "var(--ink)" }}>
            {overview.stuckCount}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
            {overview.stuckCount > 0 ? "ask why on Monday" : "nothing stalled"}
          </div>
        </div>
        <div style={cardBase}>
          <div className="kicker">Won / lost this Q</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 3 }}>
            <span className="tabular" style={{ color: "#15803D" }}>{overview.wonThisQCount}</span>
            <span style={{ color: "var(--muted-line)" }}> / </span>
            <span className="tabular" style={{ color: "#B91C1C" }}>{overview.lostThisQCount}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {overview.winRatePct !== null ? `${overview.winRatePct}% win rate` : "no closes yet"}
          </div>
        </div>
      </div>

      {/* New leads to qualify */}
      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <span className="kicker">New leads to qualify ({newLeads.length})</span>
          <Link href="/dashboard/sales/leads" style={{ fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}>
            All leads →
          </Link>
        </div>
        {newLeads.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
            Inbox zero — <Link href="/dashboard/sales/leads">capture a lead</Link> when you have one.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {newLeads.map((l) => (
              <LeadRow key={l.id} lead={l} orgs={orgs} staff={staff} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      {/* Pipeline — six stacked stage sections */}
      <section style={{ marginTop: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Pipeline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {overview.columns.map((col) => {
            const sum = col.deals.reduce((n, d) => n + d.valueCents, 0);
            const stuckHere = col.deals.filter((d) => d.stuck).length;
            const color = STAGE_COLORS[col.stage as DealStage];
            return (
              <div key={col.stage}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flex: "none", alignSelf: "center" }} />
                  <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em", color: stuckHere > 0 ? "#B45309" : "var(--ink)" }}>
                    {col.label}
                  </span>
                  <span className="tabular kicker" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: stuckHere > 0 ? "#FFF7ED" : "var(--surface)", color: stuckHere > 0 ? "#B45309" : "var(--muted)" }}>
                    {col.deals.length}
                    {stuckHere > 0 ? ` · ${stuckHere} ⚠ stuck` : ""}
                  </span>
                  {sum > 0 && <Money cents={sum} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }} />}
                  {col.probabilityPct !== null && col.toward && (
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }} title="Win-probability anchor">
                      anchor ≈{col.probabilityPct}% → {col.toward}
                    </span>
                  )}
                </div>
                {col.deals.length === 0 ? (
                  <p style={{ color: "var(--muted-line)", fontSize: 13, margin: "0 0 2px 20px" }}>—</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {col.deals.map((d) => (
                      <DealRow key={d.id} deal={d} canManage={canManage} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Won strip */}
      <section style={{ marginTop: 30 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#DCF5E3",
            border: "1px solid #BFE8CF",
            borderRadius: 12,
            padding: "12px 16px",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#16A34A", flex: "none" }} />
          <span style={{ fontWeight: 800, fontSize: 14.5, color: "#15803D" }}>Won ({overview.wonDeals.length})</span>
          {wonCents > 0 && <Money cents={wonCents} style={{ fontWeight: 700, fontSize: 13.5, color: "#15803D" }} />}
          <span className="mono" style={{ fontSize: 11, color: "#3f9560", marginLeft: "auto" }}>
            each links to its deal room
          </span>
        </div>
        {overview.wonDeals.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {overview.wonDeals.map((d) => (
              <DealRow key={d.id} deal={d} canManage={canManage} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
