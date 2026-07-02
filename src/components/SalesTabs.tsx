/**
 * Board · Leads · Proposals segmented control — the in-content twin of the sidebar
 * sub-nav, so every sales destination is reachable two ways (frame 21+).
 */
import Link from "next/link";

const TABS = [
  { key: "board", label: "Board", href: "/dashboard/sales" },
  { key: "leads", label: "Leads", href: "/dashboard/sales/leads" },
  { key: "proposals", label: "Proposals", href: "/dashboard/sales/proposals" },
] as const;

export function SalesTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--surface)", borderRadius: 999, padding: 3, gap: 2 }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              textDecoration: "none",
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: isActive ? "var(--ink)" : "var(--muted)",
              background: isActive ? "var(--white)" : "transparent",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,.1)" : "none",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
