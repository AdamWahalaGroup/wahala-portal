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
import { DealProcessPanel, GoalRail, StagesVsGatesCallout } from "@/components/DealProcessPanel";
import { MeetingCard, type MeetingCardData } from "@/components/MeetingCard";
import { ScheduleCallModal } from "@/components/ScheduleCallModal";
import { EXPLAIN, readinessTone, type PackageFields } from "@/domain/process";
import { FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";

type Tab = "overview" | "proposal" | "agreements" | "history";

const SUB_STATUSES = ["redlines with counsel", "verbal yes · terms open"];

const nextStageOf = (s: DealStage): DealStage | null => {
  const i = (FUNNEL_STAGES as readonly DealStage[]).indexOf(s);
  if (i >= 0 && i < FUNNEL_STAGES.length - 1) return FUNNEL_STAGES[i + 1];
  if (s === "committed") return "won";
  return null;
};

export type DrawerProcess = {
  trainingMode: boolean;
  readiness: number | null;
  fields: PackageFields;
  journey: { key: string; label: string }[];
  journeyIndex: number;
  goal: string;
  nextActions: { n: number; text: string; active: boolean }[];
  calls: { id: string; title: string; recordedAt: string; durationMin: number | null; fieldsExtracted: number }[];
  meetings: MeetingCardData[];
  zoomReady: boolean;
  calendarConnected: boolean;
  memberEmail: string;
};

export function DealDrawer({
  deal,
  org,
  owner,
  contact,
  provenance,
  scout,
  process,
  postMortemMd,
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
  /** The process model (frame 38): guidance layer + Discovery Package data. */
  process: DrawerProcess;
  /** Auto post-mortem markdown (frame 40) — present once the deal is lost. */
  postMortemMd: string | null;
  proposalNode: React.ReactNode;
  agreementsNode: React.ReactNode;
  historyNode: React.ReactNode;
  fieldsNode: React.ReactNode;
  canManage: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [logBump, setLogBump] = useState(0);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleWhen, setRescheduleWhen] = useState("");
  const meta = STAGE_META[deal.stage];
  // The deal's next step, upgraded to a real event when one exists (frame 42).
  const nextMeeting = process.meetings
    .filter((m) => m.status === "upcoming" && new Date(m.startsAt).getTime() > Date.now() - 90 * 60_000)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const pastMeetings = process.meetings.filter((m) => m !== nextMeeting).slice(0, 3);

  async function reschedule(meetingId: string) {
    if (!rescheduleWhen) return;
    setBusy(true);
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(rescheduleWhen).toISOString() }),
      });
      setRescheduling(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
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
      {/* Goal rail (frame 38, training mode only) */}
      {process.trainingMode && !terminal && (
        <GoalRail goal={process.goal} journey={process.journey} journeyIndex={process.journeyIndex} />
      )}

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
        {deal.daysInStage}d in step
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
        {terminal ? meta.label.toLowerCase() : `pipeline step ${stageNo} of ${SEGMENTS} — ${meta.label}`}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8, flexWrap: "wrap" }}>
        <span
          className="kicker"
          title={process.trainingMode ? undefined : EXPLAIN.stagesVsGates}
          style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 5, background: `${STAGE_COLORS[deal.stage]}1A`, color: STAGE_COLORS[deal.stage] }}
        >
          {meta.label}
        </span>
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
            {/* Stages-vs-gates explainer under the step chip (training mode) */}
            {process.trainingMode && !terminal && <StagesVsGatesCallout />}

            {/* Post-mortem (frame 40) — auto-generated when the deal was lost */}
            {deal.stage === "lost" && postMortemMd && (
              <section style={{ background: "var(--white)", border: "1px solid #F4CFCF", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span className="kicker" style={{ color: "#B91C1C" }}>Post-mortem</span>
                  <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "#FBE3E3", color: "#B91C1C", borderRadius: 5, padding: "2px 8px" }}>LOST</span>
                  <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>auto post-mortem</span>
                </div>
                <SimpleMarkdown md={postMortemMd} size={12.5} />
              </section>
            )}

            {/* Committed leads with the agreement package + handoff (frame 34);
                every other open stage gets the next-step card — upgraded to a real
                Google event when one exists (frame 42). */}
            {committed ? (
              agreementsNode
            ) : (
              !terminal && (
                <div style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 12, padding: "13px 15px" }}>
                  <div className="kicker" style={{ marginBottom: 6 }}>Next step</div>
                  {nextMeeting ? (
                    <>
                      <MeetingCard meeting={nextMeeting} canEdit={canManage} />
                      {rescheduling === nextMeeting.id && (
                        <div style={{ display: "flex", gap: 7, marginTop: 8, alignItems: "center" }}>
                          <input type="datetime-local" style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 12, flex: 1 }} value={rescheduleWhen} onChange={(e) => setRescheduleWhen(e.target.value)} />
                          <button onClick={() => reschedule(nextMeeting.id)} disabled={busy || !rescheduleWhen} style={{ border: 0, background: "var(--ink)", color: "var(--white)", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            {busy ? "…" : "Update event"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>{nextStepFor(deal.stage)}</p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {canManage && next && (
                      <button
                        onClick={() => patchDeal({ stage: next })}
                        disabled={busy}
                        style={{ background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
                      >
                        {busy ? "Moving…" : `Done → ${next === "won" ? "Won" : STAGE_META[next].label}`}
                      </button>
                    )}
                    {canManage && nextMeeting && (
                      <button
                        onClick={() => setRescheduling((v) => (v === nextMeeting.id ? null : nextMeeting.id))}
                        disabled={busy}
                        style={{ background: "var(--white)", color: "var(--ink-soft)", border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        Reschedule
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {/* After the call · automatic (frame 42) */}
            {!terminal && nextMeeting && (
              <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 14px" }}>
                <div className="kicker" style={{ marginBottom: 5 }}>After the call · automatic</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
                  recording → transcript → ◆ AI digest → deal facts
                </div>
                <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 4 }}>
                  {process.zoomReady
                    ? "Zoom cloud recording feeds the pipeline — nothing to do after you hang up."
                    : "until Zoom connects, log the call below after it ends — same pipeline, one paste."}
                </div>
              </div>
            )}

            {/* Recent meetings (past) */}
            {pastMeetings.length > 0 && (
              <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="kicker">Meetings</div>
                {pastMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} canEdit={canManage} showAttendees={false} />
                ))}
              </section>
            )}

            {/* Discovery package + next best action + recorded calls (frame 38) */}
            {!terminal && (
              <DealProcessPanel
                dealId={deal.id}
                canManage={canManage}
                trainingMode={process.trainingMode}
                readiness={process.readiness}
                tone={readinessTone(process.readiness ?? 0)}
                fields={process.fields}
                nextActions={process.nextActions}
                calls={process.calls}
                openLog={logBump}
              />
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

      {/* Footer (frame 42): Draft proposal · Schedule call · Log a call */}
      {!terminal && canManage && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 14 }}>
          <button
            onClick={() => setTab("proposal")}
            style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Draft proposal
          </button>
          <button
            onClick={() => setScheduling(true)}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Schedule call
          </button>
          <button
            onClick={() => {
              setTab("overview");
              setLogBump((n) => n + 1);
            }}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Log a call
          </button>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>Schedule = future · Log = past</span>
        </div>
      )}

      {scheduling && (
        <ScheduleCallModal
          dealId={deal.id}
          dealName={deal.name}
          accountName={org.name}
          orgId={org.id}
          memberEmail={process.memberEmail}
          zoomReady={process.zoomReady}
          calendarConnected={process.calendarConnected}
          onClose={() => setScheduling(false)}
        />
      )}
    </div>
  );
}
