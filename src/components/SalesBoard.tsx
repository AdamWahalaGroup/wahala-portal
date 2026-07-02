"use client";

/**
 * Sales Board (frame 21) — a true kanban: unsorted leads enter on the left
 * (Triage IS the lead inbox; dragging a lead into Discovery is the qualify
 * action), money exits on the right (Won/Lost drop zones). Stages stay
 * dispositions: drag any card anywhere, every move logged, never enforced.
 * The old stacked layout survives as the ☰ List view.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Money } from "@/components/Money";
import { ScoreChip, DaysTag, STAGE_COLORS, stageSelectStyle } from "@/components/SalesChips";
import { CardPeek, type PeekTarget, type PeekAnchor } from "@/components/CardPeek";
import type { SalesOverview, DealItem, LeadItem, FunnelColumn } from "@/services/sales";
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

/** $7,200,000 cents → "$72k"; sub-$1k stays exact. */
function fmtK(cents: number): string {
  const d = Math.round(cents / 100);
  return d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${d}`;
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

// ---------------------------------------------------------------- deal row (List view)

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

// ---------------------------------------------------------------- kanban view

const CARD_CAP = 6;

function dragPayload(e: React.DragEvent): { kind: "lead" | "deal"; id: string } | null {
  const raw = e.dataTransfer.getData("text/plain");
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  const kind = raw.slice(0, idx);
  if (kind !== "lead" && kind !== "deal") return null;
  return { kind, id: raw.slice(idx + 1) };
}

function KanbanView({ overview, canManage }: { overview: SalesOverview; canManage: boolean }) {
  const router = useRouter();
  const newLeads = overview.leads.filter((l) => l.status === "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [peek, setPeek] = useState<{ target: PeekTarget; anchor: PeekAnchor } | null>(null);

  function openPeek(target: PeekTarget, e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPeek({ target, anchor: { top: r.top, left: r.left, width: r.width, height: r.height } });
  }

  async function run(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const err = await patch(url, body);
    if (err) setError(err);
    else router.refresh();
    setBusy(false);
  }

  function allowDrop(e: React.DragEvent, key: string) {
    if (!canManage || busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(key);
  }

  async function handleDrop(e: React.DragEvent, target: DealStage) {
    e.preventDefault();
    setOver(null);
    const p = dragPayload(e);
    if (!p || !canManage || busy) return;
    if (p.kind === "lead") {
      // Dragging a lead into Discovery IS the qualify action.
      if (target !== "discovery") {
        setError("To qualify a lead, drag it into Discovery. (Deals can move anywhere.)");
        return;
      }
      await run(`/api/leads/${p.id}`, { action: "qualify" });
      return;
    }
    if (target === "lost") {
      const reason = window.prompt("Why did we lose it? (goes in the log)");
      if (reason === null) return;
      await run(`/api/deals/${p.id}`, { stage: "lost", reason });
      return;
    }
    await run(`/api/deals/${p.id}`, { stage: target });
  }

  async function passLead(lead: LeadItem) {
    if (!window.confirm(`Pass on ${lead.name}?`)) return;
    setPeek(null);
    await run(`/api/leads/${lead.id}`, { action: "disqualify" });
  }

  async function qualifyFromPeek(leadId: string) {
    setPeek(null);
    await run(`/api/leads/${leadId}`, { action: "qualify" });
  }

  const dealCard = (d: DealItem) => {
    const isPeeked = peek?.target.kind === "deal" && peek.target.deal.id === d.id;
    return (
    <div
      key={d.id}
      draggable={canManage}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", `deal:${d.id}`);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => openPeek({ kind: "deal", deal: d }, e)}
      style={{
        background: "var(--white)",
        border: isPeeked ? "1.5px solid #C9D0FB" : "1px solid #EDEDF1",
        boxShadow: isPeeked ? "0 0 0 3px #F3F5FF" : "0 1px 2px rgba(0,0,0,.04)",
        borderRadius: 10,
        padding: "11px 12px",
        cursor: canManage ? "grab" : "pointer",
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--cobalt)", lineHeight: 1.3 }}>{d.name}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {d.organizationName}
        {d.ownerName ? ` · ${d.ownerName}` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
        <span className="tabular" style={{ fontSize: 12, fontWeight: 600 }}>{d.valueCents > 0 ? fmtK(d.valueCents) : ""}</span>
        <DaysTag days={d.daysInStage} stuck={d.stuck} />
      </div>
    </div>
    );
  };

  const column = (col: FunnelColumn) => {
    const sum = col.deals.reduce((n, d) => n + d.valueCents, 0);
    const stuckHere = col.deals.filter((d) => d.stuck).length;
    const amber = stuckHere > 0;
    const isOpen = !!expanded[col.stage];
    const shown = isOpen ? col.deals : col.deals.slice(0, CARD_CAP);
    const hidden = col.deals.slice(shown.length);
    return (
      <div
        key={col.stage}
        onDragOver={(e) => allowDrop(e, col.stage)}
        onDragLeave={() => setOver((v) => (v === col.stage ? null : v))}
        onDrop={(e) => handleDrop(e, col.stage)}
        style={{
          background: amber ? "#FFFAF2" : "var(--white)",
          border: over === col.stage ? "1.5px solid var(--cobalt)" : `1px solid ${amber ? "#FADCB4" : "#E7E8EC"}`,
          borderRadius: 12,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 120,
          transition: "border-color 120ms ease, background 120ms ease",
        }}
      >
        <div style={{ padding: "4px 4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: STAGE_COLORS[col.stage], flex: "none" }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.01em", minWidth: 0 }}>{col.label}</span>
            <span
              className="tabular"
              style={{
                fontSize: 10.5,
                fontWeight: amber ? 700 : 600,
                color: amber ? "#B45309" : "var(--muted)",
                background: amber ? "#FCEFDC" : "#F1F2F4",
                padding: "1px 7px",
                borderRadius: 999,
                flex: "none",
                marginLeft: "auto",
              }}
            >
              {col.deals.length}
              {amber ? ` · ${stuckHere}⚠` : ""}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 3 }}>
            {sum > 0 ? <b style={{ color: "var(--ink-soft)" }}>{fmtK(sum)}</b> : "—"}
            {col.probabilityPct !== null && (
              <> · ≈{col.probabilityPct}% {col.toward === "close" ? "close" : "→ proposal"}</>
            )}
          </div>
        </div>
        {shown.map(dealCard)}
        {hidden.length > 0 && (
          <button
            onClick={() => setExpanded((m) => ({ ...m, [col.stage]: true }))}
            className="mono"
            style={{ border: 0, background: "none", fontSize: 10, color: "#B4B9C1", cursor: "pointer", padding: "2px 0" }}
          >
            +{hidden.length} more · {fmtK(hidden.reduce((n, d) => n + d.valueCents, 0))}
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Condensed summary strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          background: "var(--white)",
          border: "1px solid #E7E8EC",
          borderRadius: 11,
          padding: "11px 18px",
          margin: "18px 0",
        }}
      >
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          Open <b className="tabular" style={{ color: "var(--ink)" }}>{fmtK(overview.openPipelineCents)}</b>{" "}
          <span className="tabular" style={{ color: "var(--muted-line)" }}>· wtd {fmtK(overview.openWeightedCents)}</span>
        </span>
        <span style={{ width: 1, height: 16, background: "#EDEDF1", flex: "none" }} />
        <span className="tabular" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {overview.columns.reduce((n, c) => n + c.deals.length, 0)} open deals
        </span>
        {overview.stuckCount > 0 && (
          <>
            <span style={{ width: 1, height: 16, background: "#EDEDF1", flex: "none" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309", background: "#FFF7ED", border: "1px solid #FADCB4", padding: "3px 10px", borderRadius: 999 }}>
              ⚠ {overview.stuckCount} stuck 14d+
            </span>
          </>
        )}
        <span className="tabular" style={{ fontSize: 12.5, color: "var(--muted)", marginLeft: "auto", fontWeight: 700 }}>
          This Q <span style={{ color: "#15803D" }}>{overview.wonThisQCount} won</span>
          <span style={{ color: "var(--muted-line)" }}> / </span>
          <span style={{ color: "#B91C1C" }}>{overview.lostThisQCount} lost</span>
          {overview.winRatePct !== null && <span style={{ color: "var(--muted-line)" }}> · {overview.winRatePct}%</span>}
        </span>
      </div>

      {error && (
        <p style={{ color: "#b00020", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
      )}

      {/* Columns: Triage + the six funnel stages */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, alignItems: "start" }}>
        {/* Triage — leads, not deals yet */}
        <div
          style={{
            background: "var(--surface)",
            border: "1.5px dashed #D7D9DF",
            borderRadius: 12,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 120,
          }}
        >
          <div style={{ padding: "4px 4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--cobalt)", flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Triage</span>
              <span className="tabular" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cobalt)", background: "#EEF0FE", padding: "1px 7px", borderRadius: 999, marginLeft: "auto" }}>
                {newLeads.length}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 3 }}>new leads land here</div>
          </div>
          {newLeads.map((l) => {
            const isPeeked = peek?.target.kind === "lead" && peek.target.lead.id === l.id;
            return (
            <div
              key={l.id}
              draggable={canManage}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `lead:${l.id}`);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={(e) => openPeek({ kind: "lead", lead: l }, e)}
              style={{
                background: "var(--white)",
                border: isPeeked ? "1.5px solid #C9D0FB" : `1px solid ${l.overdue ? "#FADCB4" : "#E7E8EC"}`,
                boxShadow: isPeeked ? "0 0 0 3px #F3F5FF" : "none",
                borderRadius: 10,
                padding: "11px 12px",
                cursor: canManage ? "grab" : "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "inherit", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                  {l.name}
                </span>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      passLead(l);
                    }}
                    title="Pass on this lead"
                    style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 13, lineHeight: 1, cursor: "pointer", padding: 0, flex: "none" }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10, color: l.overdue ? "#B45309" : "var(--muted-line)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.overdue ? "⚠ overdue · " : ""}
                {l.source ? `via ${l.source}` : l.company ?? "—"}
              </div>
              <div style={{ marginTop: 8 }}>
                <ScoreChip score={l.aiScore} verdict={l.aiVerdict} />
              </div>
            </div>
            );
          })}
          <div className="mono" style={{ fontSize: 9.5, color: "#B4B9C1", textAlign: "center", padding: "2px 0" }}>
            {newLeads.length > 0 ? "drag right to qualify →" : "inbox zero"}
          </div>
        </div>

        {overview.columns.map(column)}
      </div>

      {/* Won / Lost drop zones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12, marginTop: 14 }}>
        <div
          onDragOver={(e) => allowDrop(e, "won")}
          onDragLeave={() => setOver((v) => (v === "won" ? null : v))}
          onDrop={(e) => handleDrop(e, "won")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#DCF5E3",
            border: over === "won" ? "1.5px solid #16A34A" : "1.5px dashed #9FD9B4",
            borderRadius: 12,
            padding: "13px 16px",
            transition: "border-color 120ms ease",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#16A34A", flex: "none" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#15803D" }}>Won</span>
          <span className="tabular" style={{ fontSize: 11, fontWeight: 700, color: "#15803D", background: "#C6ECD2", padding: "2px 9px", borderRadius: 999 }}>
            {overview.wonThisQCount} this quarter
          </span>
          {overview.wonThisQCents > 0 && (
            <span className="tabular" style={{ fontSize: 13, fontWeight: 700, color: "#15803D" }}>{fmtK(overview.wonThisQCents)}</span>
          )}
          <span className="mono" style={{ fontSize: 10, color: "#6BB383", marginLeft: "auto" }}>
            drop a deal here → becomes a project
          </span>
        </div>
        <div
          onDragOver={(e) => allowDrop(e, "lost")}
          onDragLeave={() => setOver((v) => (v === "lost" ? null : v))}
          onDrop={(e) => handleDrop(e, "lost")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#FBE3E3",
            border: over === "lost" ? "1.5px solid #B91C1C" : "1.5px dashed #ECB6B6",
            borderRadius: 12,
            padding: "13px 16px",
            transition: "border-color 120ms ease",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#B91C1C", flex: "none" }} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#B91C1C" }}>Lost</span>
          <span className="tabular" style={{ fontSize: 11, fontWeight: 700, color: "#B91C1C", background: "#F4CFCF", padding: "2px 9px", borderRadius: 999 }}>
            {overview.lostThisQCount}
          </span>
          <span className="mono" style={{ fontSize: 10, color: "#C58A8A", marginLeft: "auto" }}>reason logged</span>
        </div>
      </div>

      {peek && (
        <CardPeek
          target={peek.target}
          anchor={peek.anchor}
          busy={busy}
          onClose={() => setPeek(null)}
          onQualify={qualifyFromPeek}
          onPass={passLead}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- list view (the old layout, kept as ☰)

function ListView({ overview, canManage }: { overview: SalesOverview; canManage: boolean }) {
  const newLeads = overview.leads.filter((l) => l.status === "new");
  const pursueCount = newLeads.filter((l) => l.aiVerdict === "pursue").length;
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
      {/* Leads nudge bar — the Board's Triage column holds the actual inbox */}
      {newLeads.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            background: "var(--cobalt-wash)",
            border: "1px solid #DDE1FB",
            borderRadius: 11,
            padding: "11px 16px",
            marginTop: 18,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--cobalt)", flex: "none" }} />
          <span style={{ fontSize: 13 }}>
            <b>{newLeads.length} new lead{newLeads.length === 1 ? "" : "s"}</b> waiting to qualify
            {pursueCount > 0 ? <> — {pursueCount} scored <b>pursue</b></> : null}
          </span>
          <Link href="/dashboard/sales/leads" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
            Review leads →
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
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

      {/* Pipeline — six stacked stage sections */}
      <section style={{ marginTop: 32 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          Pipeline
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {overview.columns.map((col) => {
            const sum = col.deals.reduce((n, d) => n + d.valueCents, 0);
            const stuckHere = col.deals.filter((d) => d.stuck).length;
            const color = STAGE_COLORS[col.stage];
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
            border: "1px solid #BFE6CC",
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

// ---------------------------------------------------------------- board shell (header + ▦/☰ toggle)

const VIEW_KEY = "wahala.sales-view";

export function SalesBoard({ overview, canManage }: { overview: SalesOverview; canManage: boolean }) {
  const [view, setView] = useState<"board" | "list">("board");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      // private mode etc. — default stands
    }
  }, []);

  function pick(v: "board" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // non-persistent is fine
    }
  }

  const tab = (v: "board" | "list", label: string) => (
    <button
      onClick={() => pick(v)}
      style={{
        border: 0,
        borderRadius: 7,
        padding: "6px 12px",
        fontSize: 12.5,
        fontWeight: view === v ? 600 : 500,
        color: view === v ? "var(--ink)" : "#767B85",
        background: view === v ? "var(--white)" : "transparent",
        boxShadow: view === v ? "0 1px 2px rgba(0,0,0,.06)" : "none",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="kicker">Sales</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Pipeline</h1>
        </div>
        <div style={{ display: "flex", background: "#F1F2F4", borderRadius: 9, padding: 3, flex: "none" }}>
          {tab("board", "▦ Board")}
          {tab("list", "☰ List")}
        </div>
        <Link
          href="/dashboard/sales/leads"
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            borderRadius: 9,
            padding: "9px 15px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            flex: "none",
          }}
        >
          + Capture lead
        </Link>
      </div>
      {view === "board" ? <KanbanView overview={overview} canManage={canManage} /> : <ListView overview={overview} canManage={canManage} />}
    </div>
  );
}
