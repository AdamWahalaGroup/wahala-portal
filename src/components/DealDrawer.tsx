"use client";

/**
 * Deal drawer content (frame 29) — the deal room reorganized for the 520px drawer:
 * a name + value header with a mini stage progress bar, then tabs
 * Overview · Proposal · Contract · History. Overview leads with the next-step card
 * (with a "Done → next" quick-advance), the scout report carried from the source lead,
 * people, provenance, and the editable deal record. The heavy sections are passed in
 * as server-rendered nodes; this component only switches tabs + the client bits.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { ScoreChip, DaysTag, STAGE_COLORS } from "@/components/SalesChips";
import { DealStageSelect } from "@/components/DealEditor";
import { PeopleCard } from "@/components/People";
import { FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";

type Tab = "overview" | "proposal" | "contract" | "history";

const nextStageOf = (s: DealStage): DealStage | null => {
  const i = (FUNNEL_STAGES as readonly DealStage[]).indexOf(s);
  if (i >= 0 && i < FUNNEL_STAGES.length - 1) return FUNNEL_STAGES[i + 1];
  if (s === "contract") return "won";
  return null;
};

export function DealDrawer({
  deal,
  org,
  owner,
  contact,
  provenance,
  scout,
  proposalNode,
  contractNode,
  historyNode,
  fieldsNode,
  canManage,
}: {
  deal: { id: string; name: string; valueCents: number; stage: DealStage; daysInStage: number; stuck: boolean };
  org: { id: string; name: string; status: string };
  owner: { name: string } | null;
  contact: { name: string; email: string | null; phone: string | null } | null;
  provenance: { source: string | null; notes: string | null; createdAt: string } | null;
  scout: { md: string | null; score: number | null; verdict: "pursue" | "probe" | "pass" | null };
  proposalNode: React.ReactNode;
  contractNode: React.ReactNode;
  historyNode: React.ReactNode;
  fieldsNode: React.ReactNode;
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const meta = STAGE_META[deal.stage];
  const terminal = deal.stage === "won" || deal.stage === "lost";
  const filled = deal.stage === "won" ? 6 : deal.stage === "lost" ? 0 : (FUNNEL_STAGES as readonly DealStage[]).indexOf(deal.stage) + 1;
  const next = nextStageOf(deal.stage);

  async function advance() {
    if (!next) return;
    setBusy(true);
    try {
      await fetch(`/api/deals/${deal.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage: next }) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (k: Tab, label: string) => (
    <button
      onClick={() => setTab(k)}
      style={{
        border: "none",
        background: "transparent",
        padding: "8px 2px",
        marginRight: 16,
        fontSize: 13,
        fontWeight: tab === k ? 800 : 600,
        color: tab === k ? "var(--ink)" : "var(--muted)",
        borderBottom: tab === k ? "2px solid var(--cobalt)" : "2px solid transparent",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header: name + value, meta, mini stage bar */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{deal.name}</h1>
        <Money cents={deal.valueCents} style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }} />
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        <Link href={`/dashboard/clients/${org.id}`}>{org.name}</Link>
        {" · "}
        {org.status === "prospect" ? "prospect" : org.status}
        {owner ? ` · owner ${owner.name}` : ""}
        {" · "}
        {deal.daysInStage}d in stage
        {deal.stuck ? " ⚠ stuck" : ""}
      </div>
      {/* Mini stage progress bar */}
      <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
        {FUNNEL_STAGES.map((s, i) => (
          <span key={s} title={STAGE_META[s].label} style={{ flex: 1, height: 5, borderRadius: 999, background: i < filled ? "#2563EB" : "#EDEDF1" }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span className="kicker" style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 5, background: `${STAGE_COLORS[deal.stage]}1A`, color: STAGE_COLORS[deal.stage] }}>{meta.label}</span>
        {canManage && <DealStageSelect dealId={deal.id} stage={deal.stage} />}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginTop: 16, flexWrap: "wrap" }}>
        {tabBtn("overview", "Overview")}
        {tabBtn("proposal", "Proposal")}
        {tabBtn("contract", "Contract")}
        {tabBtn("history", "History")}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Next step card */}
            {!terminal && (
              <div style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 12, padding: "13px 15px" }}>
                <div className="kicker" style={{ marginBottom: 4 }}>Next step</div>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{nextStepFor(deal.stage)}</p>
                {canManage && next && (
                  <button
                    onClick={advance}
                    disabled={busy}
                    style={{ marginTop: 10, background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
                  >
                    {busy ? "Moving…" : `Done → ${STAGE_META[next].label}`}
                  </button>
                )}
              </div>
            )}

            {/* Scout report from the lead */}
            {(scout.md || scout.score !== null) && (
              <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="kicker">Scout report</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>from lead</span>
                  {scout.score !== null && <span style={{ marginLeft: "auto" }}><ScoreChip score={scout.score} verdict={scout.verdict} /></span>}
                </div>
                {scout.md ? (
                  <div className="mono" style={{ background: "#FBFBFC", border: "1px solid #EDEDF1", borderRadius: 10, padding: "10px 12px", maxHeight: 240, overflowY: "auto" }}>
                    <SimpleMarkdown md={scout.md} size={12} />
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-line)" }}>◆ Not analyzed.</p>
                )}
              </section>
            )}

            {/* People */}
            {(owner || contact) && (
              <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="kicker">People</div>
                {owner && <PeopleCard name={owner.name} role="Deal owner" variant="owner" />}
                {contact && (
                  <div>
                    <PeopleCard name={contact.name} role="Primary contact" variant="lead" />
                    {(contact.email || contact.phone) && (
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{[contact.email, contact.phone].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Deal record (fields) */}
            <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Deal record</div>
              {fieldsNode}
            </section>

            {/* Provenance */}
            {provenance && (
              <section>
                <div className="kicker" style={{ marginBottom: 6 }}>Where this came from</div>
                <div style={{ background: "#fffdf5", border: "1px solid #f0e6c8", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                  Lead captured {new Date(provenance.createdAt).toLocaleDateString()}
                  {provenance.source ? <> · via <strong>{provenance.source}</strong></> : null}
                  {provenance.notes && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontStyle: "italic", color: "var(--muted)" }}>&ldquo;{provenance.notes}&rdquo;</p>}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "proposal" && <div>{proposalNode}</div>}
        {tab === "contract" && <div>{contractNode ?? <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>The contract room opens once a proposal is approved.</p>}</div>}
        {tab === "history" && <div>{historyNode}</div>}
      </div>
    </div>
  );
}
