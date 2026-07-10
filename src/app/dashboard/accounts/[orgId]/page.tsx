/**
 * Account page (frame 33 — "one thread", canonical). Sales and delivery are two
 * lenses over the same Account: one interleaved timeline on the left (deals,
 * projects, agreements, contacts — loop moments chipped ↺), and the right rail
 * holds Contacts (shared records, editable), Open deals (board deep-links),
 * Projects, and Agreements. The MSA lives here — once signed, later deals skip
 * legal and go proposal → SOW. Staff only.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { getAccountView } from "@/services/accounts";
import { StageError } from "@/domain/stage-machine";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { Money } from "@/components/Money";
import { ClientMemoEditor } from "@/components/ClientMemoEditor";
import { AccountContactsCard, NewDealButton } from "@/components/AccountRail";
import { STAGE_COLORS } from "@/components/SalesChips";
import type { DealStage } from "@/domain/sales";

export const dynamic = "force-dynamic";

const STATE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  prospect: { bg: "#EEF0FE", color: "#2536C4", label: "Prospect" },
  client: { bg: "#DCF5E3", color: "#15803D", label: "Client" },
  past_client: { bg: "#F1F2F4", color: "#4B5159", label: "Past client" },
};

const DOMAIN_COLORS: Record<string, string> = {
  deal: "#2563EB",
  project: "#16A34A",
  account: "#2B3EE6",
  contact: "#0891B2",
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short" });

export default async function AccountPage({ params }: { params: Promise<{ orgId: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const { orgId } = await params;
  const view = await getAccountView(ctx, orgId).catch((e) => {
    if (e instanceof StageError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const { hub } = view;
  const canManage = ctx.isAdmin || ctx.user.role === "account_owner";
  const badge = STATE_BADGE[view.state];
  const canEditMemo = ctx.isAdmin || (ctx.user.role === "account_owner" && hub.accountOwner?.id === ctx.user.id);

  const meta = [
    `since ${new Date(hub.org.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    `${view.contacts.length} contact${view.contacts.length === 1 ? "" : "s"}`,
    hub.accountOwner ? `${hub.accountOwner.name.split(" ")[0]} owns` : null,
  ].filter(Boolean);

  return (
    <AppShell
      active="accounts"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
      wide
    >
      {/* Breadcrumb */}
      <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)" }}>
        <Link href="/dashboard/accounts" style={{ color: "inherit" }}>Accounts</Link> / {hub.org.name}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: "#F1F2F4", color: "#3A3F47", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flex: "none" }}>
          {initials(hub.org.name)}
        </span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>{hub.org.name}</h1>
        <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, flex: "none" }}>
          {badge.label}
        </span>
        {view.msaOnFile ? (
          <span className="mono" style={{ fontSize: 10, fontWeight: 700, background: "var(--cobalt-wash)", color: "#2536C4", border: "1px solid #DDE1FB", borderRadius: 999, padding: "4px 11px", flex: "none" }}>
            MSA signed · new work skips to SOW
          </span>
        ) : view.wonDealCount > 0 ? (
          <span className="mono" style={{ fontSize: 10, fontWeight: 700, background: "#FFF7ED", color: "#B45309", border: "1px solid #FADCB4", borderRadius: 999, padding: "4px 11px", flex: "none" }}>
            ⚠ no MSA — repeat work renegotiates legal
          </span>
        ) : null}
        <span style={{ marginLeft: "auto" }}>
          {canManage && <NewDealButton orgId={orgId} contacts={view.contacts.map((c) => ({ id: c.id, name: c.name }))} />}
        </span>
      </div>
      {/* Money: won vs committed, never a summed "lifetime" that double-counts open deals. */}
      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
        {meta.join(" · ")}
        {view.lifetimeWonCents > 0 && (
          <>
            {" · won "}
            <b style={{ color: "var(--ink-soft)" }}>
              <Money cents={view.lifetimeWonCents} />
            </b>
          </>
        )}
        {(() => {
          const committedCents = view.openDeals.filter((d) => d.stage === "committed").reduce((n, d) => n + d.valueCents, 0);
          return committedCents > 0 ? (
            <>
              {" · committed "}
              <b style={{ color: "var(--ink-soft)" }}>
                <Money cents={committedCents} />
              </b>
            </>
          ) : null;
        })()}
      </div>

      {/* Two-column grid: the one thread + the rail */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 16, marginTop: 22, alignItems: "start" }}>
        {/* One thread — sales & delivery */}
        <section style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span className="kicker">One thread — sales &amp; delivery</span>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>newest first</span>
          </div>
          {view.timeline.length === 0 ? (
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--muted-line)" }}>
              Nothing yet — capture a contact or open a deal on this account.
            </p>
          ) : (
            <div style={{ marginTop: 14 }}>
              {view.timeline.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: i === view.timeline.length - 1 ? 0 : 16 }}>
                  {/* node + connector */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: DOMAIN_COLORS[t.domain], marginTop: 4, flex: "none" }} />
                    {i !== view.timeline.length - 1 && <span style={{ width: 1, flex: 1, background: "var(--border-soft)", marginTop: 3 }} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                      <strong>{t.title}</strong>
                      {t.detail ? <span style={{ color: "var(--ink-soft)" }}> — {t.detail}</span> : null}
                      {t.loop && (
                        <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: "var(--cobalt-wash)", color: "#2536C4", border: "1px solid #DDE1FB", borderRadius: 5, padding: "1px 7px", marginLeft: 8, whiteSpace: "nowrap" }}>
                          ↺ the loop
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 2 }}>
                      {t.domain} · {fmtDate(t.at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AccountContactsCard orgId={orgId} accountName={hub.org.name} contacts={view.contacts} canManage={canManage} />

          {/* Open deals */}
          <section style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "16px 18px" }}>
            <div className="kicker">Open deals</div>
            {view.openDeals.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted-line)" }}>None open.</p>
            ) : (
              <div style={{ marginTop: 6 }}>
                {view.openDeals.map((d) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid var(--border-softer)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[d.stage as DealStage], flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/dashboard/sales/deals/${d.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}>
                        {d.name}
                      </Link>
                      <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                        {d.stageLabel} · <Money cents={d.valueCents} />
                        {d.docsTotal !== null ? ` · docs ${d.docsDone}/${d.docsTotal}${d.depositDue ? " · deposit due" : ""}` : d.subStatus ? ` · ${d.subStatus}` : ""}
                      </div>
                    </div>
                    <Link href={`/dashboard/sales/deals/${d.id}`} className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
                      board →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Projects */}
          <section style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "16px 18px" }}>
            <div className="kicker">Projects</div>
            {view.projects.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted-line)" }}>None yet — a Committed deal&apos;s deposit creates one.</p>
            ) : (
              <div style={{ marginTop: 6 }}>
                {view.projects.map((p) => {
                  const activeish = p.status === "active" || p.status === "completed";
                  const done = p.status === "completed" || p.status === "archived";
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid var(--border-softer)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: activeish ? "#16A34A" : "#C4C8CF", flex: "none" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/dashboard/projects/${p.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: "inherit", textDecoration: "none" }}>
                          {p.name}
                        </Link>
                        <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                          {p.status}
                          {p.kind === "paid_discovery" ? " · paid discovery" : ""}
                          {p.spawnedFromDealName ? ` · from ${p.spawnedFromDealName}` : ""}
                        </div>
                      </div>
                      {done && canManage && (
                        <NewDealButton
                          orgId={orgId}
                          contacts={view.contacts.map((c) => ({ id: c.id, name: c.name }))}
                          origin="spawned_from_project"
                          originProjectId={p.id}
                          label="↺ next deal"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Agreements */}
          <section style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "16px 18px" }}>
            <div className="kicker">Agreements</div>
            {view.agreements.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted-line)" }}>None yet — the package seeds when a deal reaches Committed.</p>
            ) : (
              <div style={{ marginTop: 6 }}>
                {view.agreements
                  .filter((a) => a.status !== "n_a")
                  .map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--border-softer)" }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          background: a.status === "signed" ? "#DCF5E3" : "#F1F2F4",
                          color: a.status === "signed" ? "#15803D" : "#9AA0AA",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 800,
                          flex: "none",
                        }}
                      >
                        {a.status === "signed" ? "✓" : "–"}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{a.label}</span>
                      {(a.kind === "msa" || a.kind === "nda") && (
                        <Link href={`/dashboard/accounts/${orgId}/${a.kind}`} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
                          doc →
                        </Link>
                      )}
                      <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)", flex: "none" }}>
                        {a.status === "signed" && a.signedAt ? fmtDate(a.signedAt) : a.note ?? a.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* AI memo — existing feature, kept as a collapsed card */}
          <details style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "14px 18px" }}>
            <summary className="kicker" style={{ cursor: "pointer", listStyle: "none" }}>AI memory (client-memory.md)</summary>
            <div style={{ marginTop: 10 }}>
              <ClientMemoEditor orgId={orgId} initial={hub.org.aiContextMd ?? ""} canEdit={canEditMemo} />
            </div>
          </details>
        </div>
      </div>
    </AppShell>
  );
}
