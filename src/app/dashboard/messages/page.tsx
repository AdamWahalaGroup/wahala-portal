/**
 * Messages (design frame 11) — threaded, attributed comms. A thread is a project:
 * 300px thread list (each with a waiting-on dot) + thread view (waiting-on pill,
 * Wahala-left / client-right bubbles, composer). Tenant- + visibility-scoped.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listThreads, getThread, type WaitingOn } from "@/services/messages";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/People";
import { MessageComposer } from "@/components/MessageComposer";
import { AutoRefresh } from "@/components/AutoRefresh";
import { WAITING_ON } from "@/lib/theme";

export const dynamic = "force-dynamic";

/** A waiting-on flag, phrased for the viewer (amber = the ball is in your court). */
type WaitTok = { bg: string; text: string; border: string; dot: string; label: string };
function waitView(waitingOn: WaitingOn, isStaff: boolean): { label: string; tok: WaitTok } | null {
  if (waitingOn === "none") return null;
  const onYou = (isStaff && waitingOn === "wahala") || (!isStaff && waitingOn === "client");
  return onYou
    ? { label: "Waiting on you", tok: WAITING_ON.you }
    : { label: `Waiting on ${isStaff ? "the client" : "Wahala"}`, tok: WAITING_ON.wahala };
}

function fmtWhen(d: Date): string {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);

  const threads = await listThreads(ctx);
  const { project: projParam } = await searchParams;
  const selectedId =
    projParam && threads.some((t) => t.projectId === projParam) ? projParam : threads[0]?.projectId ?? null;
  const thread = selectedId ? await getThread(ctx, selectedId) : null;
  const headerWait = thread ? waitView(thread.waitingOn, ctx.isStaff) : null;

  return (
    <AppShell
      active="messages"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName={ctx.isStaff ? "Wahala Group" : null}
      accountOwner={null}
    >
      <div className="kicker">Messages</div>
      <h1 style={{ margin: "6px 0 18px", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Messages</h1>

      {threads.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No conversations yet. They open up once you have a project.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--white)",
            height: "calc(100vh - 200px)",
            minHeight: 480,
          }}
        >
          {/* Thread list */}
          <aside style={{ borderRight: "1px solid var(--border)", overflowY: "auto", background: "var(--surface-soft)" }}>
            {threads.map((t) => {
              const active = t.projectId === selectedId;
              const w = waitView(t.waitingOn, ctx.isStaff);
              return (
                <Link
                  key={t.projectId}
                  href={`/dashboard/messages?project=${t.projectId}`}
                  style={{
                    display: "block",
                    padding: "13px 15px",
                    borderBottom: "1px solid var(--border-soft)",
                    textDecoration: "none",
                    color: "inherit",
                    background: active ? "var(--white)" : "transparent",
                    boxShadow: active ? "inset 2px 0 0 var(--ink)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {w && <span style={{ width: 8, height: 8, borderRadius: 999, background: w.tok.dot, flex: "none" }} />}
                    <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.projectName}
                    </span>
                  </div>
                  {ctx.isStaff && t.organizationName && (
                    <div className="kicker" style={{ marginTop: 3 }}>
                      {t.organizationName}
                    </div>
                  )}
                  <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.lastBody ?? "No messages yet"}
                  </div>
                </Link>
              );
            })}
          </aside>

          {/* Thread view */}
          <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <AutoRefresh />
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{thread?.projectName ?? "—"}</div>
                {ctx.isStaff && thread && (
                  <div className="kicker" style={{ marginTop: 2 }}>
                    {thread.organizationName}
                  </div>
                )}
              </div>
              {headerWait && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 11px",
                    borderRadius: 999,
                    background: headerWait.tok.bg,
                    color: headerWait.tok.text,
                    border: `1px solid ${headerWait.tok.border}`,
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: headerWait.tok.dot }} />
                  {headerWait.label}
                </span>
              )}
            </header>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14, background: "var(--surface-soft)" }}>
              {!thread || thread.messages.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "auto" }}>
                  No messages yet — start the conversation below.
                </p>
              ) : (
                thread.messages.map((m) => {
                  const left = m.senderIsStaff;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: left ? "flex-start" : "flex-end" }}>
                      <div style={{ maxWidth: "76%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: left ? "row" : "row-reverse", marginBottom: 4 }}>
                          <Avatar name={m.senderName} size={24} variant={left ? "lead" : "default"} />
                          <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m.senderName}</span>
                          <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                            {m.senderOrgName} · {fmtWhen(m.createdAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            background: left ? "#F4F5F7" : "#EEF0FE",
                            color: "var(--ink)",
                            borderRadius: 12,
                            padding: "10px 13px",
                            fontSize: 14,
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {selectedId && <MessageComposer projectId={selectedId} isStaff={ctx.isStaff} />}
          </section>
        </div>
      )}
    </AppShell>
  );
}
