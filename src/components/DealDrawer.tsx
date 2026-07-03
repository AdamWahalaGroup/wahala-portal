"use client";

/**
 * Deal drawer content (frames 29 + 34) — the deal room reorganized for the 520px
 * drawer: a name + value header with the 5-segment stage bar (Triage counts as
 * stage 1), then tabs Overview · Proposal · Agreements · History. Overview leads
 * with the next-step card ("Done → next"), or — at Committed — the agreement
 * package + "when the deposit clears" handoff card. The heavy sections are passed
 * in as server-rendered nodes; this component only switches tabs + the client bits.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { ScoreChip, STAGE_COLORS } from "@/components/SalesChips";
import { DealStageSelect } from "@/components/DealEditor";
import { PeopleCard } from "@/components/People";
import { ContactBlock } from "@/components/ContactBlock";
import { FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";

type Tab = "overview" | "proposal" | "agreements" | "history";

const SUB_STATUSES = ["redlines with counsel", "verbal yes · terms open"];

const nextStageOf = (s: DealStage): DealStage | null => {
  const i = (FUNNEL_STAGES as readonly DealStage[]).indexOf(s);
  if (i >= 0 && i < FUNNEL_STAGES.length - 1) return FUNNEL_STAGES[i + 1];
  if (s === "committed") return "won";
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
  agreementsNode,
  historyNode,
  fieldsNode,
  canManage,
}: {
  deal: { id: string; name: string; valueCents: number; stage: DealStage; daysInStage: number; stuck: boolean; origin: string; subStatus: string | null };
  org: { id: string; name: string; status: string };
  owner: { name: string } | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  provenance: { source: string | null; notes: string | null; createdAt: string } | null;
  scout: { md: string | null; score: number | null; verdict: "pursue" | "probe" | "pass" | null };
  proposalNode: React.ReactNode;
  agreementsNode: React.ReactNode;
  historyNode: React.ReactNode;
  fieldsNode: React.ReactNode;
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const meta = STAGE_META[deal.stage];
  const terminal = deal.stage === "won" || deal.stage === "lost";
  const committed = deal.stage === "committed";
  // 5 segments: Triage is stage 1; a Discovery deal is "stage 2 of 5".
  const SEGMENTS = 5;
  const stageNo = deal.stage === "won" ? 5 : deal.stage === "lost" ? 0 : (FUNNEL_STAGES as readonly DealStage[]).indexOf(deal.stage) + 2;
  const next = nextStageOf(deal.stage);

  async function patchDeal(body: unknown) {
    setBusy(true);
    try {
      await fetch(`/api/deals/${deal.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
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
      {/* Header: name + value, meta, provenance chip, 5-segment stage bar */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{deal.name}</h1>
        <Money cents={deal.valueCents} style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }} />
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        <Link href={`/dashboard/accounts/${org.id}`}>{org.name}</Link>
        {" · "}
        {org.status === "prospect" ? "prospect" : org.status === "active" ? "client" : org.status}
        {contact ? ` · ${contact.name}` : ""}
        {owner ? ` · ${owner.name}` : ""}
        {" · "}
        {deal.daysInStage}d in stage
        {deal.stuck ? " ⚠ stuck" : ""}
      </div>
      {deal.origin === "spawned_from_project" && (
        <div className="mono" style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, background: "#EEF0FE", color: "#2536C4", border: "1px solid #DDE1FB", padding: "3px 9px", borderRadius: 6, marginTop: 8 }}>
          ◆ born from paid discovery — spawned at project closeout
        </div>
      )}
      {/* 5-segment stage progress bar (Triage = segment 1) */}
      <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < stageNo ? "#2563EB" : "#EDEDF1" }} />
        ))}
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 5 }}>
        {terminal ? meta.label.toLowerCase() : `stage ${stageNo} of ${SEGMENTS} — ${meta.label}`}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        <span className="kicker" style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 5, background: `${STAGE_COLORS[deal.stage]}1A`, color: STAGE_COLORS[deal.stage] }}>{meta.label}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canManage && deal.stage === "negotiating" && (
            <select
              value={deal.subStatus ?? ""}
              disabled={busy}
              onChange={(e) => patchDeal({ subStatus: e.target.value || null })}
              title="Negotiating substatus — shows on the board card"
              style={{ border: "1px solid #E2E3E8", borderRadius: 8, padding: "6px 8px", fontSize: 11.5, fontWeight: 600, background: "var(--white)" }}
            >
              <option value="">no substatus</option>
              {SUB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {canManage && <DealStageSelect dealId={deal.id} stage={deal.stage} />}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginTop: 16, flexWrap: "wrap" }}>
        {tabBtn("overview", "Overview")}
        {tabBtn("proposal", "Proposal")}
        {tabBtn("agreements", "Agreements")}
        {tabBtn("history", "History")}
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Committed leads with the agreement package + handoff (frame 34);
                every other open stage gets the next-step card. */}
            {committed ? (
              agreementsNode
            ) : (
              !terminal && (
                <div style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 12, padding: "13px 15px" }}>
                  <div className="kicker" style={{ marginBottom: 4 }}>Next step</div>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{nextStepFor(deal.stage)}</p>
                  {canManage && next && (
                    <button
                      onClick={() => patchDeal({ stage: next })}
                      disabled={busy}
                      style={{ marginTop: 10, background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
                    >
                      {busy ? "Moving…" : `Done → ${next === "won" ? "Won" : STAGE_META[next].label}`}
                    </button>
                  )}
                </div>
              )
            )}

            {/* Scout report on the (shared) contact */}
            {(scout.md || scout.score !== null) && (
              <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="kicker">Scout report</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>on the contact</span>
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

            {/* Contact — shared, editable from here (edits apply everywhere) */}
            {contact && (
              <ContactBlock contactId={contact.id} name={contact.name} orgName={org.name} email={contact.email} phone={contact.phone} canManage={canManage} />
            )}

            {/* Deal owner */}
            {owner && (
              <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="kicker">Deal owner</div>
                <PeopleCard name={owner.name} role="Deal owner" variant="owner" />
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
                  Contact captured {new Date(provenance.createdAt).toLocaleDateString()}
                  {provenance.source ? <> · via <strong>{provenance.source}</strong></> : null}
                  {deal.origin === "bypass" ? <> · <strong>bypassed triage</strong></> : null}
                  {provenance.notes && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", fontStyle: "italic", color: "var(--muted)" }}>&ldquo;{provenance.notes}&rdquo;</p>}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "proposal" && <div>{proposalNode}</div>}
        {tab === "agreements" && <div>{agreementsNode ?? <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>The agreement package opens once a proposal is approved.</p>}</div>}
        {tab === "history" && <div>{historyNode}</div>}
      </div>
    </div>
  );
}
