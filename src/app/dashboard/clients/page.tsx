/**
 * Clients (staff) — onboard prospects + see each client's invite status.
 */
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listClients, listWahalaStaff } from "@/services/clients";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { OnboardClientForm } from "@/components/OnboardClientForm";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

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

export default async function ClientsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const clients = await listClients(ctx);
  const staff = ctx.isAdmin ? await listWahalaStaff(ctx) : [];

  return (
    <AppShell
      active="clients"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <AutoRefresh enabled={clients.some((c) => c.contact?.status === "invited")} />
      <div className="kicker">Clients</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>Clients</h1>
      <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14.5 }}>
        Onboard a prospect after your 1:1, then invite them to the portal.
      </p>

      {ctx.isAdmin && (
        <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>
            Onboard a new client
          </div>
          <OnboardClientForm staff={staff} currentUserId={ctx.user.id} />
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>
          All clients ({clients.length})
        </div>
        {clients.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No clients yet.</p>
        ) : (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            {clients.map((c, i) => (
              <div
                key={c.org.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 220px 110px 40px",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px 16px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-soft)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.org.name}</div>
                  {c.org.intakeNotes && (
                    <div
                      className="kicker"
                      style={{ marginTop: 2, textTransform: "none", letterSpacing: 0, fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {c.org.intakeNotes}
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  {c.contact ? (
                    <>
                      <div style={{ fontSize: 13.5 }}>{c.contact.name}</div>
                      <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
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
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
