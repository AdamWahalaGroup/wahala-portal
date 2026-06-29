/**
 * Clients (staff, design frame 14) — left: status-filtered clients table
 * (All / Invited / Accepted); right: the slight-grey "Onboard a client" panel.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listClients, listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { OnboardClientForm } from "@/components/OnboardClientForm";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Avatar } from "@/components/People";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "invited", label: "Invited" },
  { key: "accepted", label: "Accepted" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function StatusPill({ status }: { status?: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "#dcf5e3", text: "#15803d", label: "Accepted" },
    invited: { bg: "#fff7ed", text: "#b45309", label: "Invited" },
    disabled: { bg: "#f1f2f4", text: "#4b5159", label: "Disabled" },
  };
  const s = map[status ?? ""] ?? { bg: "#f1f2f4", text: "#4b5159", label: "—" };
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const clients = await listClients(ctx);
  const staff = ctx.isAdmin ? await listWahalaStaff(ctx) : [];

  const { status } = await searchParams;
  const filter: FilterKey = status === "invited" || status === "accepted" ? status : "all";
  const counts = {
    all: clients.length,
    invited: clients.filter((c) => c.contact?.status === "invited").length,
    accepted: clients.filter((c) => c.contact?.status === "active").length,
  };
  const filtered = clients.filter((c) =>
    filter === "invited" ? c.contact?.status === "invited" : filter === "accepted" ? c.contact?.status === "active" : true,
  );

  return (
    <AppShell
      active="clients"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <AutoRefresh enabled={counts.invited > 0} />
      <div className="kicker">Clients</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Clients</h1>
      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14.5 }}>
        Onboard a prospect after your 1:1, then invite them to the portal.
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
        {/* Left: status filter + clients table */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link key={f.key} href={`/dashboard/clients?status=${f.key}`} style={{ textDecoration: "none" }}>
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
              {clients.length === 0 ? "No clients yet — onboard one on the right." : `No ${filter} clients.`}
            </p>
          ) : (
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {filtered.map((c, i) => (
                <div
                  key={c.org.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 150px 110px 30px 16px",
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
                        href={`/dashboard/clients/${c.org.id}`}
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
                        <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.contact.name}</div>
                        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.contact.email}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>No contact</span>
                    )}
                  </div>
                  <div style={{ justifySelf: "start" }}>
                    <StatusPill status={c.contact?.status} />
                  </div>
                  <div style={{ justifySelf: "end" }}>
                    {ctx.isAdmin && <DeleteClientButton orgId={c.org.id} name={c.org.name} />}
                  </div>
                  <Link
                    href={`/dashboard/clients/${c.org.id}`}
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
              Onboard a new client
            </div>
            <OnboardClientForm staff={staff} currentUserId={ctx.user.id} />
          </aside>
        )}
      </div>
    </AppShell>
  );
}
