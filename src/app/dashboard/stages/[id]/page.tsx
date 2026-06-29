/**
 * Stage detail — the lifecycle screen: stepper, pay-gate banner, line items, and a
 * right rail with the (server-computed) allowed actions, money, people, and history.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getStageDetail } from "@/services/stages";
import { listTasksForStage, assignableForStage } from "@/services/tasks";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Stepper } from "@/components/Stepper";
import { Money } from "@/components/Money";
import { StageActions } from "@/components/StageActions";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { WaitingOn } from "@/components/WaitingOn";
import { PeopleCard } from "@/components/People";
import { TasksClient } from "@/components/TasksClient";
import { waitingParty } from "@/lib/stage-ui";

export const dynamic = "force-dynamic";

const PAID_OR_BEYOND = new Set(["paid", "in_progress", "delivered", "accepted"]);

export default async function StagePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const { id } = await params;
  const detail = await getStageDetail(ctx, id).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { stage, people, lineItems, audit, actions } = detail;

  const [tasks, assignable] = await Promise.all([
    listTasksForStage(ctx, id),
    ctx.isStaff ? assignableForStage(ctx, id) : Promise.resolve([]),
  ]);
  const canManageTasks = ctx.isAdmin || detail.resource.projectLeadUserId === ctx.user.id;

  const paid = PAID_OR_BEYOND.has(stage.status);
  const party = waitingParty(stage.status);
  const who = party === "none" ? null : (ctx.isStaff ? party === "wahala" : party === "client") ? "you" : "wahala";

  return (
    <AppShell
      active="projects"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={detail.organizationName}
      accountOwner={ctx.isStaff ? null : people.accountOwner ? { name: people.accountOwner } : null}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          <Link href="/dashboard">Projects</Link> /{" "}
          <Link href={`/dashboard/projects/${stage.projectId}`}>Project</Link> / {stage.name}
        </div>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-soft)", background: "var(--surface)", borderRadius: 999, padding: "4px 10px" }}
        >
          Viewing as · {ctx.user.role}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", marginTop: 18 }}>
        {/* Main */}
        <div style={{ paddingRight: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-.025em" }}>{stage.name}</h1>
            <StatusBadge status={stage.status} />
          </div>

          <div style={{ marginTop: 24 }}>
            <Stepper status={stage.status} />
          </div>

          {paid && (
            <div
              style={{
                marginTop: 24,
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#e1f4f9",
                border: "1px solid #b9e3ee",
                borderRadius: 12,
                padding: "13px 15px",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#0891b2",
                  color: "var(--white)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  flex: "none",
                }}
              >
                ✓
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0e7490" }}>
                Paid in full — work cleared to begin.
              </span>
            </div>
          )}

          {stage.scopeDescription && (
            <p style={{ marginTop: 22, color: "var(--ink-soft)", fontSize: 14.5 }}>{stage.scopeDescription}</p>
          )}

          {/* Line items = the acceptance checklist */}
          <section style={{ marginTop: 22 }}>
            <div className="kicker" style={{ marginBottom: 10 }}>
              Line items ({lineItems.length})
            </div>
            {lineItems.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No line items.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {lineItems.map((li) => {
                  const checked = stage.status === "accepted";
                  return (
                    <li
                      key={li.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "11px 0",
                        borderBottom: "1px solid var(--border-soft)",
                      }}
                    >
                      <span
                        style={{
                          width: 19,
                          height: 19,
                          borderRadius: 6,
                          flex: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          background: checked ? "#16a34a" : "var(--white)",
                          color: "var(--white)",
                          border: checked ? "none" : "1.5px solid #d7d9df",
                        }}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span style={{ fontSize: 14.5 }}>
                        {li.description}
                        {li.estimateNote && (
                          <span style={{ color: "var(--muted)", fontSize: 13 }}> · {li.estimateNote}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {ctx.isStaff && (
              <div
                style={{
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--surface-soft-2)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 9,
                  padding: "8px 11px",
                  fontSize: 12.5,
                  color: "var(--muted)",
                }}
              >
                <span style={{ color: "var(--ink)" }}>⊘</span> Internal tasks &amp; recordings on this stage are hidden from the client.
              </div>
            )}
          </section>

          {/* Tasks */}
          <section style={{ marginTop: 28 }}>
            <div className="kicker" style={{ marginBottom: 12 }}>
              Tasks ({tasks.length})
            </div>
            <TasksClient tasks={tasks} assignable={assignable} stageId={stage.id} canManage={canManageTasks} />
          </section>
        </div>

        {/* Right rail */}
        <aside style={{ borderLeft: "1px solid var(--border)", paddingLeft: 30, display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div className="kicker">Stage total</div>
            <Money cents={stage.totalAmountCents} style={{ display: "block", fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", marginTop: 4 }} />
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
              {paid ? `Paid${stage.paidAt ? ` · ${new Date(stage.paidAt).toLocaleDateString()}` : ""}` : "Due in full before work begins"}
            </div>
          </div>

          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, boxShadow: "var(--shadow-card)" }}>
            <div className="kicker" style={{ marginBottom: 12 }}>
              Your next action
            </div>
            <StageActions stageId={stage.id} actions={actions} />
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Only actions your role allows in this state are shown.
            </p>
          </div>

          {who && (
            <div>
              <WaitingOn who={who} />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="kicker">People</div>
            {people.accountOwner && <PeopleCard name={people.accountOwner} role="Account owner" variant="owner" />}
            {people.leadEngineer && <PeopleCard name={people.leadEngineer} role="Lead engineer" variant="lead" />}
          </div>

          <div>
            <div className="kicker" style={{ marginBottom: 12 }}>
              History
            </div>
            <HistoryTimeline items={audit} />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
