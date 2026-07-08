/**
 * Accounts (staff) — the org list under the two-object model (CRM-RESTRUCTURE):
 * an account is prospect → client (first won deal) → past client. Left: state-
 * filtered table; right: the onboard panel (create the org + portal invite).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listClients, listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { OnboardClientForm } from "@/components/OnboardClientForm";
import { ArchiveAccountButton, RestoreAccountButton } from "@/components/ArchiveAccountButton";
import { DangerDeleteButton } from "@/components/DangerDeleteButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Avatar } from "@/components/People";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "prospects", label: "Prospects" },
  { key: "clients", label: "Clients" },
  { key: "archived", label: "Archived" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/** Account state pill: prospect (blue) → client (green) → past client (grey). */
function StatePill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    prospect: { bg: "#EEF0FE", text: "#2536C4", label: "Prospect" },
    active: { bg: "#dcf5e3", text: "#15803d", label: "Client" },
    archived: { bg: "#f1f2f4", text: "#4b5159", label: "Past client" },
  };
  const s = map[status] ?? { bg: "#f1f2f4", text: "#4b5159", label: status };
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function InvitePill({ status }: { status?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    active: { color: "#15803d", label: "portal ✓" },
    invited: { color: "#b45309", label: "invited" },
    disabled: { color: "#4b5159", label: "disabled" },
  };
  const s = map[status ?? ""];
  if (!s) return null;
  return (
    <span className="mono" style={{ color: s.color, fontSize: 10.5, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const accounts = await listClients(ctx);
  const staff = ctx.isAdmin ? await listWahalaStaff(ctx) : [];

  const { state } = await searchParams;
  const filter: FilterKey = state === "prospects" || state === "clients" || state === "archived" ? state : "all";
  const counts = {
    all: accounts.filter((c) => c.org.status !== "archived").length,
    prospects: accounts.filter((c) => c.org.status === "prospect").length,
    clients: accounts.filter((c) => c.org.status === "active").length,
    archived: accounts.filter((c) => c.org.status === "archived").length,
  };
  // Archived accounts hide from active lists (soft archive) — they live in their own filter.
  const filtered = accounts.filter((c) =>
    filter === "prospects"
      ? c.org.status === "prospect"
      : filter === "clients"
        ? c.org.status === "active"
        : filter === "archived"
          ? c.org.status === "archived"
          : c.org.status !== "archived",
  );
  const invitedCount = accounts.filter((c) => c.contact?.status === "invited").length;

  return (
    <AppShell
      active="accounts"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <AutoRefresh enabled={invitedCount > 0} />
      <div className="kicker">Accounts</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Accounts</h1>
      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14.5 }}>
        One record per organization — &ldquo;client&rdquo; is a state it earns on its first won deal.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: ctx.isAdmin ? "minmax(0,1fr) 330px" : "minmax(0,1fr)",
          gap: 28,
          marginTop: 22,
          alignItems: "start",
        }}
      >
        {/* Left: state filter + accounts table */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link key={f.key} href={`/dashboard/accounts?state=${f.key}`} style={{ textDecoration: "none" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "6px 13px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      background: active ? "var(--ink)" : "var(--surface)",
                      color: active ? "var(--white)" : "var(--muted)",
                      border: `1px solid ${active ? "var(--ink)" : "var(--border)"}`,
                    }}
                  >
                    {f.label}
                    <span style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.85 }}>{counts[f.key]}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              {accounts.length === 0 ? "No accounts yet — capture a contact on the board, or onboard one on the right." : `No ${filter}.`}
            </p>
          ) : (
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {filtered.map((c, i) => (
                <div
                  key={c.org.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px 110px 60px 16px",
                    gap: 12,
                    alignItems: "center",
                    padding: "13px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={c.org.name} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <Link
                        href={`/dashboard/accounts/${c.org.id}`}
                        style={{ fontWeight: 700, fontSize: 14.5, color: "inherit", textDecoration: "none" }}
                      >
                        {c.org.name}
                      </Link>
                      {c.org.intakeNotes && (
                        <div
                          className="kicker"
                          style={{ marginTop: 2, textTransform: "none", letterSpacing: 0, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {c.org.intakeNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {c.contact ? (
                      <>
                        <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.contact.name} <InvitePill status={c.contact.status} />
                        </div>
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.contact.email}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>No portal contact</span>
                    )}
                  </div>
                  <div style={{ justifySelf: "start" }}>
                    <StatePill status={c.org.status} />
                  </div>
                  <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 10 }}>
                    {ctx.isAdmin &&
                      (c.org.status === "archived" ? (
                        <RestoreAccountButton orgId={c.org.id} name={c.org.name} />
                      ) : (
                        <ArchiveAccountButton orgId={c.org.id} name={c.org.name} />
                      ))}
                    {ctx.isAdmin && (
                      <DangerDeleteButton
                        endpoint={`/api/accounts/${c.org.id}`}
                        title={`Delete ${c.org.name}?`}
                        body="Hard-deletes the account and EVERYTHING under it — deals, proposals, projects, phases, contacts, portal users, files, messages, and history. The product path is Archive; this is dev cleanup only."
                        redirectTo="/dashboard/accounts"
                      />
                    )}
                  </div>
                  <Link
                    href={`/dashboard/accounts/${c.org.id}`}
                    style={{ justifySelf: "end", color: "var(--muted-line)", textDecoration: "none", fontSize: 16 }}
                    aria-label={`Open ${c.org.name}`}
                  >
                    ›
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: onboard panel (slight grey) */}
        {ctx.isAdmin && (
          <aside
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 18,
              position: "sticky",
              top: 24,
            }}
          >
            <div className="kicker" style={{ marginBottom: 12 }}>
              Onboard an account
            </div>
            <OnboardClientForm staff={staff} currentUserId={ctx.user.id} />
          </aside>
        )}
      </div>
    </AppShell>
  );
}
