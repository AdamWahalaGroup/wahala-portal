"use client";

/**
 * Proposals list on the deal detail page + the "Draft proposal with AI" button.
 * Versions listed newest first; sending v2 supersedes v1 automatically.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Summary = {
  id: string;
  version: number;
  status: "draft" | "sent" | "approved" | "declined" | "superseded";
  title: string;
  complexityScore: number | null;
  needsReview: boolean;
  selectedLabel: string | null;
};

const STATUS_STYLE: Record<Summary["status"], { bg: string; color: string; label: string }> = {
  draft: { bg: "var(--surface)", color: "var(--ink-soft)", label: "Draft" },
  sent: { bg: "#F5F7FF", color: "#3B5BDB", label: "Sent" },
  approved: { bg: "#e8f7ee", color: "#15803d", label: "Approved" },
  declined: { bg: "#fdeeee", color: "#b91c1c", label: "Declined" },
  superseded: { bg: "var(--surface-soft)", color: "var(--muted)", label: "Superseded" },
};

export function ProposalsSection({
  dealId,
  proposals,
  canManage,
  hasDiscovery,
}: {
  dealId: string;
  proposals: Summary[];
  canManage: boolean;
  hasDiscovery: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; proposalId?: string };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else if (data.proposalId) router.push(`/dashboard/sales/proposals/${data.proposalId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div className="kicker">Proposals ({proposals.length})</div>
        {canManage && (
          <button
            onClick={draft}
            disabled={busy}
            style={{
              background: "var(--ink)",
              color: "var(--white)",
              border: "none",
              borderRadius: 8,
              padding: "7px 13px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Drafting (~20s)…" : proposals.length > 0 ? "◆ Draft new version" : "◆ Draft proposal with AI"}
          </button>
        )}
      </div>
      {!hasDiscovery && proposals.length === 0 && (
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
          Tip: distill discovery first — the proposal grounds itself in the Discovery Package.
        </p>
      )}
      {proposals.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No proposals yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {proposals.map((p) => {
            const s = STATUS_STYLE[p.status];
            return (
              <Link
                key={p.id}
                href={`/dashboard/sales/proposals/${p.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--white)",
                  border: "1px solid #ededf1",
                  borderRadius: 11,
                  padding: "11px 14px",
                  textDecoration: "none",
                  color: "inherit",
                  opacity: p.status === "superseded" ? 0.6 : 1,
                }}
              >
                <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)", flex: "none" }}>v{p.version}</span>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.title}
                </span>
                {p.complexityScore !== null && (
                  <span
                    className="kicker"
                    style={{ flex: "none", fontSize: 9.5, padding: "3px 7px", borderRadius: 5, background: p.needsReview ? "#fff7ed" : "var(--surface-soft)", color: p.needsReview ? "#b45309" : "var(--muted)" }}
                  >
                    {p.needsReview ? "⚠ " : ""}C{p.complexityScore}
                  </span>
                )}
                {p.selectedLabel && (
                  <span className="kicker" style={{ flex: "none", fontSize: 9.5, padding: "3px 7px", borderRadius: 5, background: "#e8f7ee", color: "#15803d" }}>
                    Option {p.selectedLabel}
                  </span>
                )}
                <span className="kicker" style={{ flex: "none", fontSize: 10, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>
                  {s.label}
                </span>
                <span style={{ color: "var(--muted-line)", flex: "none" }}>›</span>
              </Link>
            );
          })}
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}
