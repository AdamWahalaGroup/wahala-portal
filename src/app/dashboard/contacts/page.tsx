/**
 * Contacts — top-level people list (HANDOFF-FIX-2026-07-09, delta §4). People
 * first: a contact can stand alone, so this page is the ONLY guaranteed surface
 * for account-less, deal-less people — creation must always be visible here.
 * Row click opens the full-width contact detail page (/dashboard/contacts/[id]).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/auth/context";
import { listContactsLite } from "@/services/sales";
import { LOGIN_PATH } from "@/auth/config";
import { AppShell } from "@/components/AppShell";
import { NewContactButton } from "@/components/OpportunityModals";
import { Avatar } from "@/components/People";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect(LOGIN_PATH);
  if (!ctx.isStaff) redirect("/dashboard");

  const contacts = await listContactsLite(ctx);

  return (
    <AppShell
      active="contacts"
      user={{ name: ctx.user.name, role: ctx.user.role, isStaff: ctx.isStaff }}
      orgName="Wahala Group"
      accountOwner={null}
    >
      <div style={{ maxWidth: 1000 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="kicker">Contacts</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>Contacts</h1>
          </div>
          <NewContactButton />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5A6069" }}>
          People first. A contact can stand alone — an account only exists once at least one contact hangs off it, and every
          opportunity starts from a contact.
        </p>

        {contacts.length === 0 ? (
          <div style={{ background: "var(--white)", border: "1px solid #EDEDF1", borderRadius: 11, padding: "36px 24px", marginTop: 20, textAlign: "center" }}>
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--muted)" }}>No contacts yet — every opportunity starts from one.</p>
            <NewContactButton />
          </div>
        ) : (
          <div style={{ background: "var(--white)", border: "1px solid #EDEDF1", borderRadius: 11, marginTop: 20, overflow: "hidden" }}>
            {/* Header row */}
            <div
              className="mono"
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 110px 110px 16px",
                gap: 14,
                padding: "9px 16px",
                background: "#FBFBFC",
                borderBottom: "1px solid #F2F3F5",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#9AA0AA",
              }}
            >
              <span>Contact</span>
              <span>Company</span>
              <span>Opportunities</span>
              <span>Source</span>
              <span />
            </div>
            {contacts.map((c, i) => {
              const sub = [c.title, c.email].filter(Boolean).join(" · ");
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/contacts/${c.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 110px 110px 16px",
                    gap: 14,
                    alignItems: "center",
                    padding: "13px 16px",
                    borderTop: i === 0 ? "none" : "1px solid #F2F3F5",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={c.name} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      {sub && (
                        <div className="mono" style={{ fontSize: 10.5, color: "#9AA0AA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {sub}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {c.organizationName ? (
                      <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{c.organizationName}</span>
                    ) : (
                      <span className="mono" style={{ fontSize: 10.5, color: "#B4B9C1" }}>no account yet</span>
                    )}
                  </div>
                  <span className="mono tabular" style={{ fontSize: 12, fontWeight: 700, color: c.opportunityCount > 0 ? "var(--ink)" : "#B4B9C1" }}>
                    {c.opportunityCount > 0 ? c.opportunityCount : "—"}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "#9AA0AA", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.source ?? ""}
                  </span>
                  <span style={{ color: "#C4C8CF", fontSize: 16, justifySelf: "end" }}>›</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
