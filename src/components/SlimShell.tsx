/**
 * Slim chrome for deep detail pages (lead workspace, proposal editor): a breadcrumb
 * top bar instead of the full ink sidebar, maximizing content width
 * (design handoff, sales/00-overview.md).
 */
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Avatar } from "@/components/People";

export function SlimShell({
  crumbs,
  user,
  children,
  maxWidth = 1080,
}: {
  crumbs: { label: string; href?: string }[];
  user: { name: string; role: string };
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-soft)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--white)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Link href="/dashboard" style={{ textDecoration: "none", flex: "none" }}>
          <Brand size={18} />
        </Link>
        <nav className="mono" style={{ fontSize: 12, color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && " / "}
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span style={{ color: "var(--ink-soft)" }}>{c.label}</span>}
            </span>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          <Avatar name={user.name} size={26} variant="lead" />
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{user.name}</span>
        </div>
      </header>
      <main style={{ maxWidth, margin: "0 auto", padding: "28px 24px 64px" }}>{children}</main>
    </div>
  );
}
