"use client";

/**
 * Deal drawer (interactive-prototype card layout, 2026-07-07): NO tabs — the
 * proposal CTA sits directly under the value ("Rough out a draft" / "+ Blank
 * proposal", or "View full proposal →"), then the horizontal 4-step stage
 * stepper, the training/readiness card, and "Move to {next}" / "Mark lost"
 * (stages are dispositions; backward/skip moves live on the board). The body
 * below keeps the working surfaces: meetings, discovery package, scout,
 * contact, deal record. History left the drawer (backend intact, new surface
 * TBD); at Committed the agreement package + Create-project renders inline.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { ScoreChip, STAGE_COLORS } from "@/components/SalesChips";
import { PeopleCard } from "@/components/People";
import { ContactBlock } from "@/components/ContactBlock";
import { DealProcessPanel, ReadyPill, StagesVsGatesCallout } from "@/components/DealProcessPanel";
import { DangerDeleteButton } from "@/components/DangerDeleteButton";
import { StageMomentLayer, stageMomentFor, type StageMoment } from "@/components/StageCelebration";
import { MeetingCard, type MeetingCardData } from "@/components/MeetingCard";
import { ScheduleCallModal } from "@/components/ScheduleCallModal";
import { EXPLAIN, readinessTone, type PackageFields } from "@/domain/process";
import { FUNNEL_STAGES, STAGE_META, nextStepFor, type DealStage } from "@/domain/sales";

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
  proposalCtaNode,
  discoveryNode,
  agreementsNode,
  ndaNode = null,
  fieldsNode,
  canManage,
  isAdmin = false,
}: {
  deal: { id: string; name: string; valueCents: number; stage: DealStage; daysInStage: number; stuck: boolean; origin: string; subStatus: string | null; projectId: string | null };
  org: { id: string; name: string; status: string } | null;
  owner: { name: string } | null;
  contact: { id: string; name: string; email: string | null; phone: string | null } | null;
  provenance: { source: string | null; notes: string | null; createdAt: string } | null;
  scout: { md: string | null; score: number | null; verdict: "pursue" | "probe" | "pass" | null };
  /** The process model (frame 38): guidance layer + Discovery Package data. */
  process: DrawerProcess;
  /** Auto post-mortem markdown (frame 40) — present once the deal is lost. */
  postMortemMd: string | null;
  /** The proposal launchpad/shortcut (ProposalsSection) — renders under the value. */
  proposalCtaNode: React.ReactNode;
  /** DiscoveryPanel — renders after the process panel in the body. */
  discoveryNode: React.ReactNode;
  agreementsNode: React.ReactNode;
  /** NDA strip (Discovery → Negotiating) — the paper that belongs BEFORE committed. */
  ndaNode?: React.ReactNode;
  fieldsNode: React.ReactNode;
  canManage: boolean;
  /** DEV TOOL — renders the hard-delete affordance (admin only; comes out later). */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [logBump, setLogBump] = useState(0);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleWhen, setRescheduleWhen] = useState("");
  // Achievement moment (Jason feedback) — fired by the stage select + Done→next.
  const [moment, setMoment] = useState<StageMoment | null>(null);
  const fireMoment = (to: string) => setMoment(stageMomentFor(deal.stage, to, { id: deal.id, name: deal.name, organizationName: org?.name ?? deal.name }));
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
  const lost = deal.stage === "lost";
  // Lost = read-only everywhere: the record is a post-mortem now, not a workspace.
  const editable = canManage && !lost;
  const committed = deal.stage === "committed";
  // 4-step stepper over the funnel stages; won = all done, lost = closed out.
  const stepIdx = deal.stage === "won" ? FUNNEL_STAGES.length : (FUNNEL_STAGES as readonly DealStage[]).indexOf(deal.stage);
  const next = nextStageOf(deal.stage);

  async function patchDeal(body: { stage?: string; subStatus?: string | null; reason?: string; override?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok && body.stage) fireMoment(body.stage);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** "Move to {next}" — Discovery is excluded (09 Jul b): sending the proposal IS the advance. */
  async function moveNext() {
    if (!next || deal.stage === "discovery") return;
    await patchDeal({ stage: next });
  }

  function markLost() {
    const reason = window.prompt("Why did we lose it? (goes in the log)");
    if (reason === null) return;
    void patchDeal({ stage: "lost", reason });
  }

  return (
    <div>
      {/* Header: badge, name + value, meta, provenance chip, stage bar */}
      <span
        className="mono"
        style={{
          display: "inline-block",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: ".06em",
          padding: "2px 7px",
          borderRadius: 5,
          marginBottom: 6,
          background: deal.stage === "new" ? "#EEF0FE" : "#F1ECFD",
          color: deal.stage === "new" ? "#2536C4" : "#6D28D9",
        }}
      >
        {deal.stage === "new" ? "◔ OPPORTUNITY" : "◭ DEAL"}
      </span>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", flex: 1, minWidth: 0 }}>{deal.name}</h1>
        {isAdmin && (
          <DangerDeleteButton
            endpoint={`/api/deals/${deal.id}`}
            title={`Delete ${deal.name}?`}
            body="Hard-deletes the deal and everything under it — proposals, discovery package, calls, process history, agreement checklist. The contact and account stay. Dev tool only; the product path is Mark lost with a reason."
            redirectTo="/dashboard/sales"
          />
        )}
        <Money cents={deal.valueCents} style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }} />
      </div>
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
        {org ? (
          <>
            <Link href={`/dashboard/accounts/${org.id}`}>{org.name}</Link>
            {" · "}
            {org.status === "prospect" ? "prospect" : org.status === "active" ? "client" : org.status}
          </>
        ) : (
          <span>no account yet — born at Create project →</span>
        )}
        {contact ? (
          <>
            {" · "}
            <Link href={`/dashboard/contacts/${contact.id}`}>{contact.name}</Link>
          </>
        ) : null}
        {owner ? ` · ${owner.name}` : ""}
        {" · "}
        {deal.daysInStage}d in stage
        {deal.stuck ? " ⚠ stuck" : ""}
        {deal.projectId && (
          <>
            {" · "}
            <Link href={`/dashboard/projects/${deal.projectId}`} style={{ color: "var(--cobalt-text)", fontWeight: 700 }}>
              Project →
            </Link>
          </>
        )}
      </div>
      {deal.origin === "spawned_from_project" && (
        <div className="mono" style={{ display: "inline-block", fontSize: 9.5, fontWeight: 700, background: "#EEF0FE", color: "#2536C4", border: "1px solid #DDE1FB", padding: "3px 9px", borderRadius: 6, marginTop: 8 }}>
          ◆ born from paid discovery — spawned at project closeout
        </div>
      )}
      {/* Lost leads with WHY — the post-mortem takes the prime slot under the value */}
      {lost && (
        <section style={{ background: "var(--white)", border: "1.5px solid #F4CFCF", borderRadius: 12, padding: 14, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: postMortemMd ? 8 : 0 }}>
            <span className="kicker" style={{ color: "#B91C1C" }}>Why we lost it</span>
            <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "#FBE3E3", color: "#B91C1C", borderRadius: 5, padding: "2px 8px" }}>LOST</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>auto post-mortem · read-only record</span>
          </div>
          {postMortemMd ? (
            <SimpleMarkdown md={postMortemMd} size={12.5} />
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>No post-mortem was generated — the loss reason lives in the deal history log.</p>
          )}
        </section>
      )}

      {/* Proposal CTA — directly under the value (prototype layout; read-only shortcut when lost) */}
      <div style={{ marginTop: 14 }}>{proposalCtaNode}</div>
      {ndaNode && <div style={{ marginTop: 10 }}>{ndaNode}</div>}

      {/* Stage stepper over the open funnel */}
      <div style={{ display: "flex", marginTop: 18 }}>
        {(FUNNEL_STAGES as readonly DealStage[]).map((k, i) => {
          const done = i < stepIdx || deal.stage === "won";
          const current = i === stepIdx && !terminal;
          return (
            <div key={k} style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
              {i > 0 && (
                <span style={{ position: "absolute", top: 10, right: "50%", width: "100%", height: 2, background: i <= stepIdx ? "#2563EB" : "#EDEDF1", zIndex: 0 }} />
              )}
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  zIndex: 1,
                  background: done ? "var(--ink)" : "var(--white)",
                  border: done ? "1px solid var(--ink)" : current ? `2px solid ${STAGE_COLORS[k]}` : "1px solid #d7d9df",
                  boxShadow: current ? `0 0 0 3px ${STAGE_COLORS[k]}22` : undefined,
                  boxSizing: "border-box",
                }}
              />
              <span
                className={current ? undefined : "mono"}
                style={{ fontSize: 9.5, marginTop: 6, fontWeight: current ? 800 : 500, color: current ? "var(--ink)" : done ? "var(--ink-soft)" : "var(--muted-line)", textAlign: "center" }}
              >
                {STAGE_META[k].label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 7, textAlign: "center" }}>
        {deal.stage === "won" ? "won 🎉" : deal.stage === "lost" ? "closed lost" : `stage ${stepIdx + 1} of ${FUNNEL_STAGES.length} — ${meta.label}`}
      </div>
      {canManage && deal.stage === "negotiating" && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <select
            value={deal.subStatus ?? ""}
            disabled={busy}
            onChange={(e) => patchDeal({ subStatus: e.target.value || null })}
            title="Negotiating substatus — shows on the board card"
            style={{ border: "1px solid #E2E3E8", borderRadius: 8, padding: "6px 8px", fontSize: 11.5, fontWeight: 600, background: "var(--white)", color: "var(--ink)" }}
          >
            <option value="">no substatus</option>
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Training / readiness card (compact, prototype) */}
      {process.trainingMode && !terminal && (
        <div style={{ background: "#EEF0FE", border: "1px solid #DDE1FB", borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "var(--cobalt)", color: "var(--white)", borderRadius: 5, padding: "2px 7px", flex: "none" }}>
              TRAINING
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2536C4" }}>{process.goal}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <span className="kicker" style={{ color: "#5A6BD8" }}>Discovery package</span>
            <span style={{ marginLeft: "auto" }}>
              <ReadyPill score={process.readiness} tone={readinessTone(process.readiness ?? 0)} />
            </span>
          </div>
          <p style={{ margin: "7px 0 0", fontSize: 12, color: "#2536C4", lineHeight: 1.5 }}>
            Readiness drives when this deal is proposal-ready — completeness of the 10-field discovery package, extracted from recorded calls.
          </p>
        </div>
      )}

      {/* Stage actions — dispositions, never gates. Discovery has NO advance button
          (09 Jul b): the Proposal-out stage is event-driven — sending the proposal
          moves the deal. Mark lost stays. */}
      {canManage && !terminal && !committed && next && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 9 }}>
            {deal.stage === "discovery" ? (
              <div
                className="mono"
                style={{ flex: 1, border: "1.5px dashed #C9D0FB", background: "#FAFBFF", color: "#2536C4", borderRadius: 10, padding: "11px 14px", fontSize: 11, lineHeight: 1.5, textAlign: "center" }}
              >
                Sending the proposal moves this deal to Proposal out automatically.
              </div>
            ) : (
              <button
                onClick={() => void moveNext()}
                disabled={busy}
                style={{ flex: 1, background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 700, cursor: busy ? "default" : "pointer" }}
              >
                {busy ? "Moving…" : deal.stage === "new" ? "Accept → start Discovery" : `Move to ${next === "won" ? "Won" : STAGE_META[next].label}`}
              </button>
            )}
            <button
              onClick={markLost}
              disabled={busy}
              style={{ background: "var(--white)", color: "#B91C1C", border: "1px solid #F4CFCF", borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flex: "none" }}
            >
              Mark lost
            </button>
          </div>
          <div className="mono" title={EXPLAIN.stagesVsGates} style={{ fontSize: 9.5, color: "var(--muted-line)", textAlign: "center", marginTop: 8 }}>
            {deal.stage === "discovery" ? "the nudge is never a gate — overrides are logged to the deal" : "stages are never gates — overrides are logged to the deal"}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stages-vs-gates explainer under the step chip (training mode) */}
            {process.trainingMode && !terminal && <StagesVsGatesCallout />}

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
                  <MeetingCard key={m.id} meeting={m} canEdit={editable} showAttendees={false} />
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
                stage={deal.stage}
              />
            )}

            {/* Discovery distill (moved from the old Proposal tab) */}
            {!terminal && discoveryNode}

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
              <ContactBlock contactId={contact.id} name={contact.name} orgName={org?.name ?? "no account yet"} email={contact.email} phone={contact.phone} canManage={editable} />
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
      </div>

      {/* Footer (frame 42): Draft proposal · Schedule call · Log a call */}
      {!terminal && canManage && (
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 14 }}>
          <button
            onClick={() => setScheduling(true)}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Schedule call
          </button>
          <button
            onClick={() => setLogBump((n) => n + 1)}
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
          accountName={org?.name ?? deal.name}
          orgId={org?.id ?? ""}
          memberEmail={process.memberEmail}
          zoomReady={process.zoomReady}
          calendarConnected={process.calendarConnected}
          onClose={() => setScheduling(false)}
        />
      )}

      <StageMomentLayer moment={moment} onDismiss={() => setMoment(null)} inDrawer />
    </div>
  );
}
