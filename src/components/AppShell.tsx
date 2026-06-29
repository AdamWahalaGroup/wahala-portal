import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/People";

const NAV = [
  { key: "home", label: "Home", href: "/dashboard" as string | null },
  { key: "projects", label: "Projects", href: "/dashboard" as string | null },
  { key: "files", label: "Files", href: null },
  { key: "messages", label: "Messages", href: null },
] as const;

type NavKey = (typeof NAV)[number]["key"];

/** Ink sidebar (brand, nav, account-owner card) + main column. Wraps dashboard pages. */
export function AppShell({
  active,
  user,
  orgName,
  accountOwner,
  children,
}: {
  active: NavKey;
  user: { name: string; role: string; isStaff: boolean };
  orgName?: string | null;
  accountOwner?: { name: string } | null;
  children: React.ReactNode;
}) {
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
          {NAV.map((item) => {
            const isActive = item.key === active;
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
                  color: item.href ? (isActive ? "var(--white)" : "#aeb2bb") : "#595e67",
                  background: isActive ? "rgba(255,255,255,.08)" : "transparent",
                }}
              >
                {item.label}
                {!item.href && (
                  <span className="kicker" style={{ fontSize: 9, color: "#595e67" }}>
                    soon
                  </span>
                )}
              </span>
            );
            return item.href ? (
              <Link key={item.key} href={item.href} style={{ textDecoration: "none" }}>
                {inner}
              </Link>
            ) : (
              <div key={item.key}>{inner}</div>
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
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 36px 64px" }}>{children}</div>
      </main>
    </div>
  );
}
