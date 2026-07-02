import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/People";

const NAV = [
  { key: "home", label: "Home", href: "/dashboard" as string | null, staffOnly: false, adminOnly: false },
  { key: "sales", label: "Sales", href: "/dashboard/sales" as string | null, staffOnly: true, adminOnly: false },
  { key: "clients", label: "Clients", href: "/dashboard/clients" as string | null, staffOnly: true, adminOnly: false },
  { key: "projects", label: "Projects", href: "/dashboard" as string | null, staffOnly: false, adminOnly: false },
  { key: "files", label: "Files", href: null, staffOnly: false, adminOnly: false },
  { key: "messages", label: "Messages", href: "/dashboard/messages" as string | null, staffOnly: false, adminOnly: false },
  { key: "settings", label: "Settings", href: "/dashboard/settings" as string | null, staffOnly: true, adminOnly: true },
] as const;

// Sales is a first-class destination with a sub-nav (design handoff, sales/00-overview.md).
const SALES_SUBNAV = [
  { key: "sales-board", label: "Board", href: "/dashboard/sales" },
  { key: "sales-leads", label: "Leads", href: "/dashboard/sales/leads" },
  { key: "sales-proposals", label: "Proposals", href: "/dashboard/sales/proposals" },
] as const;

// Settings gains a sub-nav too (frame 28): AI agents · SLAs & nudges.
const SETTINGS_SUBNAV = [
  { key: "settings-agents", label: "AI agents", href: "/dashboard/settings" },
  { key: "settings-slas", label: "SLAs & nudges", href: "/dashboard/settings/slas" },
] as const;

type NavKey =
  | (typeof NAV)[number]["key"]
  | (typeof SALES_SUBNAV)[number]["key"]
  | (typeof SETTINGS_SUBNAV)[number]["key"];

/** Ink sidebar (brand, nav, account-owner card) + main column. Wraps dashboard pages. */
export function AppShell({
  active,
  user,
  orgName,
  accountOwner,
  leadCount,
  wide,
  children,
}: {
  active: NavKey;
  user: { name: string; role: string; isStaff: boolean };
  orgName?: string | null;
  accountOwner?: { name: string } | null;
  /** "To qualify" count for the Leads sub-nav badge (pass from sales pages that know it). */
  leadCount?: number | null;
  /** Wider main column for deep detail pages (lead workspace, proposal editor). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const inSales = active === "sales" || active.startsWith("sales-");
  const inSettings = active === "settings" || active.startsWith("settings-");
  const isAdmin = user.role === "wahala_admin";
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface-soft)" }}>
      <aside
        style={{
          width: 228,
          flex: "none",
          background: "var(--ink)",
          color: "#cfd2da",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ padding: "0 4px" }}>
          <Brand tone="light" size={24} />
          {orgName && (
            <div className="kicker" style={{ marginTop: 12, color: "#6b7079" }}>
              {orgName}
            </div>
          )}
        </div>

        <nav style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.filter((item) => (!item.staffOnly || user.isStaff) && (!item.adminOnly || isAdmin)).map((item) => {
            const isActive = item.key === active || (item.key === "sales" && inSales) || (item.key === "settings" && inSettings);
            // Staff get the cross-client Projects index; clients keep their dashboard.
            const href = item.key === "projects" && user.isStaff ? "/dashboard/projects" : item.href;
            const inner = (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  color: href ? (isActive ? "var(--white)" : "#aeb2bb") : "#595e67",
                  background: isActive ? "rgba(255,255,255,.08)" : "transparent",
                }}
              >
                {item.label}
                {!href && (
                  <span className="kicker" style={{ fontSize: 9, color: "#595e67" }}>
                    soon
                  </span>
                )}
              </span>
            );
            return (
              <div key={item.key}>
                {href ? (
                  <Link href={href} style={{ textDecoration: "none" }}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
                {/* Sales sub-nav: Board · Leads · Proposals — indented, left-ruled */}
                {item.key === "sales" && user.isStaff && inSales && (
                  <div style={{ margin: "2px 0 4px 18px", borderLeft: "1px solid #2c2f36", paddingLeft: 8, display: "flex", flexDirection: "column", gap: 1 }}>
                    {SALES_SUBNAV.map((sub) => {
                      const subActive = active === sub.key;
                      return (
                        <Link key={sub.key} href={sub.href} style={{ textDecoration: "none" }}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: subActive ? "var(--white)" : "#8b909a",
                              background: subActive ? "var(--cobalt)" : "transparent",
                            }}
                          >
                            {sub.label}
                            {sub.key === "sales-leads" && typeof leadCount === "number" && leadCount > 0 && (
                              <span className="tabular" style={{ fontSize: 10, fontWeight: 800, background: subActive ? "rgba(255,255,255,.25)" : "#2c2f36", color: "var(--white)", borderRadius: 999, padding: "1px 7px" }}>
                                {leadCount}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {/* Settings sub-nav: AI agents · SLAs & nudges — same indented, left-ruled pattern */}
                {item.key === "settings" && isAdmin && inSettings && (
                  <div style={{ margin: "2px 0 4px 18px", borderLeft: "1px solid #2c2f36", paddingLeft: 8, display: "flex", flexDirection: "column", gap: 1 }}>
                    {SETTINGS_SUBNAV.map((sub) => {
                      const subActive = active === sub.key;
                      return (
                        <Link key={sub.key} href={sub.href} style={{ textDecoration: "none" }}>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: subActive ? "var(--white)" : "#8b909a",
                              background: subActive ? "var(--cobalt)" : "transparent",
                            }}
                          >
                            {sub.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {accountOwner && (
            <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 12, padding: 12 }}>
              <div className="kicker" style={{ color: "#6b7079", marginBottom: 8 }}>
                Your account owner
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={accountOwner.name} variant="owner" size={32} />
                <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--white)" }}>{accountOwner.name}</div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <Avatar name={user.name} size={28} variant={user.isStaff ? "lead" : "default"} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--white)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.name}
                </div>
                <div className="kicker" style={{ fontSize: 9, color: "#6b7079" }}>
                  {user.role}
                </div>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                style={{
                  background: "transparent",
                  border: "1px solid #2c2f36",
                  color: "#aeb2bb",
                  borderRadius: 8,
                  padding: "5px 10px",
                  fontSize: 11.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: wide ? 1180 : 960, margin: "0 auto", padding: "36px 36px 64px" }}>{children}</div>
      </main>
    </div>
  );
}
