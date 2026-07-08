"use client";

/**
 * Sales Board (frame 31 — 5-stage kanban, canonical) — a true kanban: unknown
 * CONTACTS enter on the left (Triage renders contacts, not deals; dragging one into
 * Discovery is the qualify action), money exits on the right (Won/Lost drop zones).
 * Deal stages stay dispositions: drag any card anywhere, every move logged, never
 * enforced. The old stacked layout survives as the ☰ List view.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Money } from "@/components/Money";
import { ScoreChip, DaysTag, STAGE_COLORS, TRIAGE_COLOR, stageSelectStyle } from "@/components/SalesChips";
import { ContactCaptureModal } from "@/components/ContactCaptureModal";
import { ReadinessNudgeModal } from "@/components/ReadinessNudgeModal";
import { StageMomentLayer, stageMomentFor, type StageMoment } from "@/components/StageCelebration";
import { PROPOSAL_READY_AT } from "@/domain/process";
import type { SalesOverview, DealItem, ContactItem, FunnelColumn } from "@/services/sales";
import type { DealStage } from "@/domain/sales";

type StaffOption = { id: string; name: string };

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "proposal_out", label: "Proposal out" },
  { value: "negotiating", label: "Negotiating" },
  { value: "committed", label: "Committed" },
  { value: "won", label: "Won 🎉" },
  { value: "lost", label: "Lost" },
];

/** The spec's column meta hints (frame 31). */
const COLUMN_HINTS: Record<string, string> = {
  discovery: "incl. requirements",
  proposal_out: "the at-risk clock",
  negotiating: "client engaged",
  committed: "docs + deposit",
};

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

// ---------------------------------------------------------------- contact row (qualify / pass / assign — the workspace drawer)

export function ContactQualifyRow({
  contact,
  staff,
  canManage,
}: {
  contact: ContactItem;
  staff: StaffOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealName, setDealName] = useState("");
  const [value, setValue] = useState("");
  // QA delta 07-08 §2: qualify NEVER asks for an account — the contact already
  // has one from capture. Legacy accountless contacts get a one-field fallback.
  const [newAccountName, setNewAccountName] = useState(contact.companyNote ?? "");

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const err = await patch(`/api/contacts/${contact.id}`, body);
    if (err) setError(err);
    else router.refresh();
    setBusy(false);
  }

  const detail = [contact.organizationName ?? contact.companyNote, contact.phone, contact.email, contact.source && `via ${contact.source}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ background: "var(--white)", border: "1px solid #f0e6c8", borderLeft: "3px solid #FADCB4", borderRadius: 11, padding: "11px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <ScoreChip score={contact.aiScore} verdict={contact.aiVerdict} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{contact.name}</span>
          {detail && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 10 }}>
              {detail}
            </span>
          )}
        </div>
        <select
          value={contact.assignedToUserId ?? ""}
          disabled={busy}
          onChange={(e) => act({ action: "assign", assignedToUserId: e.target.value || null })}
          style={{ ...stageSelectStyle, flex: "none", fontSize: 12, padding: "6px 8px", fontWeight: 500 }}
          title="Who's working this contact"
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
              onClick={() => act({ action: "pass" })}
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
              title="Kept + searchable — never deleted"
            >
              Pass
            </button>
          </div>
        )}
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          {contact.organizationName ? (
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", flex: "1 1 150px" }}>
              deal opens on <b style={{ color: "var(--ink)" }}>{contact.organizationName}</b>
            </span>
          ) : (
            <input
              style={{ ...inputStyle, flex: "1 1 170px" }}
              placeholder="Account name (creates it)"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              title="Legacy contact without an account — name one and it's created"
            />
          )}
          <input
            style={{ ...inputStyle, flex: "2 1 180px" }}
            placeholder="Deal name (optional)"
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
          />
          <input
            style={{ ...inputStyle, flex: "1 1 100px" }}
            placeholder={contact.estValueCents > 0 ? `$${Math.round(contact.estValueCents / 100).toLocaleString("en-US")} (captured)` : "Est. value $"}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <button
            onClick={() =>
              act({
                action: "qualify",
                newAccountName: !contact.organizationId ? newAccountName.trim() || undefined : undefined,
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
            {busy ? "Working…" : "Start deal →"}
          </button>
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- deal row (List view)

function DealRow({ deal, canManage, onMoved }: { deal: DealItem; canManage: boolean; onMoved?: (m: StageMoment | null) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(stage: string) {
    setBusy(true);
    setError(null);
    const err = await patch(`/api/deals/${deal.id}`, { stage });
    if (err) setError(err);
    else {
      onMoved?.(stageMomentFor(deal.stage, stage, deal));
      router.refresh();
    }
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

function dragPayload(e: React.DragEvent): { kind: "contact" | "deal"; id: string } | null {
  const raw = e.dataTransfer.getData("text/plain");
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  const kind = raw.slice(0, idx);
  if (kind !== "contact" && kind !== "deal") return null;
  return { kind, id: raw.slice(idx + 1) };
}

/** Small status chip under a card title (negotiating substatus, committed docs…). */
function CardChip({ text, tone }: { text: string; tone: "amber" | "green" | "grey" | "cobalt" }) {
  const c =
    tone === "amber"
      ? { bg: "#FCEFDC", fg: "#B45309" }
      : tone === "green"
        ? { bg: "#DCF5E3", fg: "#15803D" }
        : tone === "cobalt"
          ? { bg: "#EEF0FE", fg: "#2536C4" }
          : { bg: "#F1F2F4", fg: "#3A3F47" };
  return (
    <span className="mono" style={{ display: "inline-block", fontSize: 9, fontWeight: 700, background: c.bg, color: c.fg, padding: "2px 7px", borderRadius: 5, marginTop: 7, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

function KanbanView({ overview, canManage, filter, currentUserId, trainingMode, onMoved }: { overview: SalesOverview; canManage: boolean; filter: SalesFilter; currentUserId?: string; trainingMode: boolean; onMoved: (m: StageMoment | null) => void }) {
  const router = useRouter();
  // Filter chips lens the board (frame 29). Counts in the summary strip stay whole.
  const dealPred = (d: DealItem): boolean => {
    if (filter === "mine") return d.ownerUserId === currentUserId;
    if (filter === "stuck") return d.stuck;
    if (filter === "proposals_out") return d.stage === "proposal_out";
    if (filter === "to_qualify") return false; // triage-only lens
    return true;
  };
  const showTriage = filter === "all" || filter === "to_qualify" || filter === "mine";
  const triage = overview.triage.filter(
    (c) => showTriage && (filter !== "mine" || c.assignedToUserId === currentUserId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Frame 39: the not-proposal-ready nudge (modal in training mode; inline line otherwise).
  const [nudge, setNudge] = useState<{ dealId: string; dealName: string } | null>(null);
  const [inlineWarn, setInlineWarn] = useState<string | null>(null);

  // A card click goes straight to its drawer (soft nav — the board stays behind).
  const openDrawer = (href: string) => router.push(href, { scroll: false });

  async function run(url: string, body: unknown): Promise<string | null> {
    setBusy(true);
    setError(null);
    const err = await patch(url, body);
    if (err) setError(err);
    else router.refresh();
    setBusy(false);
    return err;
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
    if (p.kind === "contact") {
      // Dragging a triage contact into Discovery IS the qualify action.
      if (target !== "discovery") {
        setError("To qualify a contact, drag it into Discovery. (Deals can move anywhere.)");
        return;
      }
      const c = triage.find((t) => t.id === p.id);
      const err = await run(`/api/contacts/${p.id}`, { action: "qualify" });
      if (!err && c) onMoved(stageMomentFor(null, "discovery", { id: null, name: c.name, organizationName: c.organizationName }));
      return;
    }
    const deal = [...overview.columns.flatMap((c) => c.deals)].find((d) => d.id === p.id);
    if (target === "lost") {
      const reason = window.prompt("Why did we lose it? (goes in the log)");
      if (reason === null) return;
      await run(`/api/deals/${p.id}`, { stage: "lost", reason });
      return;
    }
    if (target === "proposal_out") {
      // Frame 39: proposal-ready check. Steps are never gates — training mode gets
      // the modal, training off gets a one-line inline warning; both log.
      const score = deal?.readinessScore ?? 0;
      if (deal && deal.stage === "discovery" && score < PROPOSAL_READY_AT) {
        if (trainingMode) {
          setNudge({ dealId: deal.id, dealName: deal.name });
          return; // the modal decides: keep in Discovery, or advance with override
        }
        setInlineWarn(`⚠ ${deal.name} advanced below proposal-ready (${(deal.readinessScore ?? 0).toFixed(1)}/10) — logged to the deal.`);
        fetch(`/api/deals/${p.id}/readiness`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outcome: "fired", metadata: { surface: "board_drag_quiet" } }),
        }).catch(() => {});
        const err = await run(`/api/deals/${p.id}`, { stage: target, override: true });
        if (!err) onMoved(stageMomentFor(deal.stage, target, deal));
        return;
      }
    }
    if (target === "won") {
      // The package nudges, never blocks: warn when docs are open, then proceed.
      if (deal?.stage === "committed" && deal.docsDone !== null && deal.docsTotal !== null && deal.docsDone < deal.docsTotal) {
        if (!window.confirm(`Agreement package is ${deal.docsDone}/${deal.docsTotal} — win it anyway? (Create the project from the deal drawer.)`)) return;
      }
    }
    const err = await run(`/api/deals/${p.id}`, { stage: target });
    if (!err && deal) onMoved(stageMomentFor(deal.stage, target, deal));
  }

  async function passContact(c: ContactItem) {
    if (!window.confirm(`Pass on ${c.name}? (kept + searchable, never deleted)`)) return;
    await run(`/api/contacts/${c.id}`, { action: "pass" });
  }

  const dealCard = (d: DealItem) => {
    // Stage-specific chip (frame 31 card anatomy).
    let chip: React.ReactNode = null;
    if (d.paidDiscovery) chip = <CardChip text="◆ paid discovery · runs as a project" tone="cobalt" />;
    else if (d.stage === "negotiating" && d.subStatus) {
      const s = d.subStatus.toLowerCase();
      chip = <CardChip text={d.subStatus} tone={s.includes("redline") ? "amber" : s.includes("verbal") || s.includes("yes") ? "green" : "grey"} />;
    } else if (d.stage === "committed" && d.docsTotal !== null) {
      chip = d.msaOnFile ? (
        <CardChip text="MSA on file · SOW only" tone="green" />
      ) : (
        <CardChip text={`docs ${d.docsDone}/${d.docsTotal}${d.depositDue ? " · deposit due" : ""}`} tone="grey" />
      );
    }
    // Proposal-out cards read the at-risk clock instead of the plain days tag.
    const clock =
      d.stage === "proposal_out" ? (
        d.proposalSilent ? (
          <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: "#B45309", background: "#FCEFDC", padding: "2px 7px", borderRadius: 5 }}>
            ⚠ {d.sentDaysAgo ?? d.daysInStage}d silent
          </span>
        ) : (
          <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>sent {d.sentDaysAgo ?? d.daysInStage}d</span>
        )
      ) : (
        <DaysTag days={d.daysInStage} stuck={d.stuck} />
      );
    return (
      <div
        key={d.id}
        draggable={canManage}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", `deal:${d.id}`);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => openDrawer(`/dashboard/sales/deals/${d.id}`)}
        style={{
          background: "var(--white)",
          border: `1px solid ${d.paidDiscovery ? "#DDE1FB" : "#EDEDF1"}`,
          boxShadow: "0 1px 2px rgba(0,0,0,.04)",
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
        {chip}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
          <span className="tabular" style={{ fontSize: 12, fontWeight: 600 }}>{d.valueCents > 0 ? fmtK(d.valueCents) : ""}</span>
          {clock}
        </div>
      </div>
    );
  };

  const column = (col: FunnelColumn) => {
    const cdeals = col.deals.filter(dealPred);
    const sum = cdeals.reduce((n, d) => n + d.valueCents, 0);
    const stuckHere = cdeals.filter((d) => d.stuck).length;
    const amber = stuckHere > 0;
    const isOpen = !!expanded[col.stage];
    const shown = isOpen ? cdeals : cdeals.slice(0, CARD_CAP);
    const hidden = cdeals.slice(shown.length);
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
              {cdeals.length}
              {amber ? ` · ${stuckHere}⚠` : ""}
            </span>
          </div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 3 }}>
            {sum > 0 ? <b style={{ color: "var(--ink-soft)" }}>{fmtK(sum)}</b> : "—"}
            {col.probabilityPct !== null && <> · ≈{col.probabilityPct}% close</>}
            {COLUMN_HINTS[col.stage] && <> · {COLUMN_HINTS[col.stage]}</>}
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
        {col.stage === "committed" && (
          <div className="mono" style={{ fontSize: 9.5, color: "#B4B9C1", textAlign: "center", padding: "2px 0" }}>
            deposit clears → project ↓
          </div>
        )}
      </div>
    );
  };

  // Won / Lost containers — terminal drop targets that also HOLD the deals dropped in.
  const dropZone = (kind: "won" | "lost") => {
    const won = kind === "won";
    const deals = (won ? overview.wonDeals : overview.lostDeals).filter(dealPred);
    const sum = deals.reduce((n, d) => n + d.valueCents, 0);
    const c = won
      ? { bg: "#DCF5E3", dash: "#9FD9B4", solid: "#16A34A", text: "#15803D", pill: "#C6ECD2", hint: "drop a deal here → becomes a project on the same account" }
      : { bg: "#FBE3E3", dash: "#ECB6B6", solid: "#B91C1C", text: "#B91C1C", pill: "#F4CFCF", hint: "drop a deal here → closed lost (reason logged)" };
    return (
      <div
        onDragOver={(e) => allowDrop(e, kind)}
        onDragLeave={() => setOver((v) => (v === kind ? null : v))}
        onDrop={(e) => handleDrop(e, kind)}
        style={{
          background: c.bg,
          border: over === kind ? `1.5px solid ${c.solid}` : `1.5px dashed ${c.dash}`,
          borderRadius: 12,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 96,
          transition: "border-color 120ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: c.solid, flex: "none" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{won ? "Won" : "Lost"}</span>
          <span className="tabular" style={{ fontSize: 10.5, fontWeight: 700, color: c.text, background: c.pill, padding: "1px 8px", borderRadius: 999 }}>
            {deals.length}
          </span>
          {sum > 0 && <span className="tabular" style={{ fontSize: 12, fontWeight: 700, color: c.text }}>{fmtK(sum)}</span>}
        </div>
        {deals.length === 0 ? (
          <div className="mono" style={{ fontSize: 9.5, color: c.solid, opacity: 0.7, textAlign: "center", padding: "10px 0" }}>{c.hint}</div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>{deals.map(dealCard)}</div>
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
        {overview.atRiskCents > 0 && (
          <>
            <span style={{ width: 1, height: 16, background: "#EDEDF1", flex: "none" }} />
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              at-risk time <b className="tabular" style={{ color: "var(--ink)" }}>{fmtK(overview.atRiskCents)}</b>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}> · proposals with no reply</span>
            </span>
          </>
        )}
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
      {inlineWarn && (
        <p className="mono" style={{ color: "#B45309", fontSize: 11, margin: "0 0 12px" }}>
          {inlineWarn}
          <button onClick={() => setInlineWarn(null)} style={{ border: 0, background: "none", color: "#C4C8CF", cursor: "pointer", marginLeft: 8 }}>×</button>
        </p>
      )}

      {nudge && (
        <ReadinessNudgeModal
          dealId={nudge.dealId}
          dealName={nudge.dealName}
          onKeep={() => setNudge(null)}
          onAdvance={async () => {
            const id = nudge.dealId;
            const deal = [...overview.columns.flatMap((c) => c.deals)].find((d) => d.id === id);
            setNudge(null);
            const err = await run(`/api/deals/${id}`, { stage: "proposal_out", override: true });
            // Nudge composes first; the achievement moment only after the override lands.
            if (!err && deal) onMoved(stageMomentFor(deal.stage, "proposal_out", deal));
          }}
          onClose={() => setNudge(null)}
        />
      )}

      {/* Columns: Triage (contacts) + the four deal stages */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
        {/* Triage — contacts, not deals yet */}
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
              <span style={{ width: 9, height: 9, borderRadius: 2, background: TRIAGE_COLOR, flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Triage</span>
              <span className="tabular" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--cobalt)", background: "#EEF0FE", padding: "1px 7px", borderRadius: 999, marginLeft: "auto" }}>
                {triage.length}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 3 }}>
              unknowns only — known-enough contacts bypass this column
            </div>
          </div>
          {triage.map((c) => (
            <div
              key={c.id}
              draggable={canManage}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `contact:${c.id}`);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => openDrawer(`/dashboard/sales/contacts/${c.id}`)}
              style={{
                background: "var(--white)",
                border: `1px solid ${c.overdue ? "#FADCB4" : "#E7E8EC"}`,
                borderRadius: 10,
                padding: "11px 12px",
                cursor: canManage ? "grab" : "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "inherit", lineHeight: 1.3, flex: 1, minWidth: 0 }}>
                  {c.name}
                </span>
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      passContact(c);
                    }}
                    title="Pass on this contact"
                    style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 13, lineHeight: 1, cursor: "pointer", padding: 0, flex: "none" }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="mono" style={{ fontSize: 10, color: c.overdue ? "#B45309" : "var(--muted-line)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.overdue ? "⚠ overdue · " : ""}
                {c.source ? `via ${c.source}` : (c.organizationName ?? c.companyNote ?? "—")}
              </div>
              {c.estValueCents > 0 && (
                <div style={{ marginTop: 5 }}>
                  <span className="mono tabular" style={{ fontSize: 12.5, fontWeight: 800 }}>
                    ${Math.round(c.estValueCents / 100).toLocaleString("en-US")}
                  </span>
                  <span className="mono" style={{ fontSize: 9, color: "var(--muted-line)", marginLeft: 6 }}>
                    est{c.assignedToName ? ` · ${c.assignedToName.split(" ")[0]}` : ""}
                  </span>
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                {c.aiScore !== null ? (
                  <ScoreChip score={c.aiScore} verdict={c.aiVerdict} />
                ) : (
                  <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>not scored</span>
                )}
              </div>
            </div>
          ))}
          <div className="mono" style={{ fontSize: 9.5, color: "#B4B9C1", textAlign: "center", padding: "2px 0" }}>
            {triage.length > 0 ? "drag right to qualify →" : "inbox zero"}
          </div>
        </div>

        {overview.columns.map(column)}
      </div>

      {/* Won / Lost drop zones — containers that hold the deals dropped into them */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14, alignItems: "start" }}>
        {dropZone("won")}
        {dropZone("lost")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- list view (the old layout, kept as ☰)

function ListView({ overview, canManage, onMoved }: { overview: SalesOverview; canManage: boolean; onMoved: (m: StageMoment | null) => void }) {
  const triage = overview.triage;
  const pursueCount = triage.filter((c) => c.aiVerdict === "pursue").length;
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
      {/* Triage nudge bar — the Board's Triage column holds the actual inbox */}
      {triage.length > 0 && (
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
            <b>{triage.length} contact{triage.length === 1 ? "" : "s"}</b> waiting to qualify
            {pursueCount > 0 ? <> — {pursueCount} scored <b>pursue</b></> : null}
          </span>
          <Link href="/dashboard/sales?filter=to_qualify" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
            Review triage →
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
            {triage.length} contact{triage.length === 1 ? "" : "s"} to qualify
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

      {/* Pipeline — the four stage sections, stacked */}
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
                  {col.probabilityPct !== null && (
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }} title="Close-probability anchor">
                      anchor ≈{col.probabilityPct}% close
                    </span>
                  )}
                </div>
                {col.deals.length === 0 ? (
                  <p style={{ color: "var(--muted-line)", fontSize: 13, margin: "0 0 2px 20px" }}>—</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {col.deals.map((d) => (
                      <DealRow key={d.id} deal={d} canManage={canManage} onMoved={onMoved} />
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

export type SalesFilter = "all" | "mine" | "to_qualify" | "proposals_out" | "stuck";

export function SalesBoard({
  overview,
  canManage,
  currentUserId,
  trainingMode = false,
  showTeamLink = false,
}: {
  overview: SalesOverview;
  canManage: boolean;
  currentUserId?: string;
  /** Frame 39: modal nudge chrome when on; quiet inline warning when off. */
  trainingMode?: boolean;
  /** Frame 41: owners get the Team scorecard link. */
  showTeamLink?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const filter = (search.get("filter") as SalesFilter) || "all";
  const [view, setView] = useState<"board" | "list">("board");
  const [capturing, setCapturing] = useState(false);
  // Achievement moment (Jason feedback) — survives router.refresh, one per move.
  const [moment, setMoment] = useState<StageMoment | null>(null);

  // Chip counts come from the FULL overview (they're lenses into the whole board).
  const toQualifyN = overview.triage.length;
  const proposalsOutN = overview.columns.reduce((n, c) => n + (c.stage === "proposal_out" ? c.deals.length : 0), 0);
  const stuckN = overview.stuckCount;

  function setFilter(f: SalesFilter) {
    router.push(f === "all" ? "/dashboard/sales" : `/dashboard/sales?filter=${f}`, { scroll: false });
  }

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

  const chip = (f: SalesFilter, label: string, count?: number, countColor?: string) => {
    const on = filter === f;
    const stuckLens = f === "stuck";
    return (
      <button
        onClick={() => setFilter(f)}
        style={{
          border: on ? "1px solid transparent" : `1px solid ${stuckLens ? "#FADCB4" : "#E2E3E8"}`,
          background: on ? "var(--ink)" : stuckLens ? "#FFF7ED" : "var(--white)",
          color: on ? "var(--white)" : stuckLens ? "#B45309" : "#5A6069",
          borderRadius: 999,
          padding: "5px 11px",
          fontSize: 11.5,
          fontWeight: on ? 700 : 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {typeof count === "number" && count > 0 && (
          <span className="tabular" style={{ fontWeight: 800, color: on ? "var(--white)" : countColor ?? "inherit" }}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="kicker">Sales</div>
          <h1 style={{ margin: "6px 0 8px", fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>Pipeline</h1>
          {/* Filter chips — lenses over the one board (frame 29) */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {chip("all", "All")}
            {currentUserId && chip("mine", "Mine")}
            {chip("to_qualify", "To qualify", toQualifyN, "var(--cobalt-text)")}
            {chip("proposals_out", "Proposals out", proposalsOutN, "#0891B2")}
            {chip("stuck", "⚠ Stuck", stuckN)}
          </div>
        </div>
        <div style={{ display: "flex", background: "#F1F2F4", borderRadius: 9, padding: 3, flex: "none" }}>
          {tab("board", "▦ Board")}
          {tab("list", "☰ List")}
        </div>
        {showTeamLink && (
          <Link
            href="/dashboard/sales/team"
            style={{ flex: "none", fontSize: 12.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", padding: "9px 4px" }}
            title="Process scorecard — owners only"
          >
            Team →
          </Link>
        )}
        <button
          onClick={() => setCapturing(true)}
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            border: "1px solid transparent",
            borderRadius: 9,
            padding: "9px 15px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flex: "none",
          }}
        >
          + Capture contact
        </button>
      </div>

      {capturing && <ContactCaptureModal canStartDeal={canManage} currentUserId={currentUserId} onClose={() => setCapturing(false)} />}

      {view === "board" ? (
        <KanbanView overview={overview} canManage={canManage} filter={filter} currentUserId={currentUserId} trainingMode={trainingMode} onMoved={setMoment} />
      ) : (
        <ListView overview={overview} canManage={canManage} onMoved={setMoment} />
      )}

      <StageMomentLayer moment={moment} onDismiss={() => setMoment(null)} />
    </div>
  );
}
