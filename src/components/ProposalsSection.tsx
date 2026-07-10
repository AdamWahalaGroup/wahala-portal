"use client";

/**
 * Deal drawer · Proposal tab launchpad (HANDOFF-DELTA-2026-07-07 §2).
 * No live proposal (or the latest was declined) → TWO creation paths side by
 * side — "◆ Rough out a draft" (AI setup modal) and "+ Blank proposal" — both
 * always present, AI is never the only way in. Live proposal → the shortcut row.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProposalSetupModal } from "@/components/ProposalSetupModal";

type Summary = {
  id: string;
  version: number;
  status: "draft" | "sent" | "approved" | "declined" | "superseded";
  title: string;
  complexityScore: number | null;
  needsReview: boolean;
  selectedLabel: string | null;
};

export function ProposalsSection({
  dealId,
  proposals,
  canManage,
  hasDiscovery,
  readOnly = false,
}: {
  dealId: string;
  proposals: Summary[];
  canManage: boolean;
  hasDiscovery: boolean;
  /** Lost deals: existing proposals stay reachable, creation paths disappear. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const live = proposals.find((p) => p.status !== "superseded") ?? null;
  const needsCreate = !live || live.status === "declined";

  async function createBlank() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "blank" }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; proposalId?: string };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else if (data.proposalId) router.push(`/dashboard/proposals/${data.proposalId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Sent", approved: "Approved", declined: "Declined", superseded: "Superseded" };

  return (
    <section>
      {live && live.status !== "declined" && (
        <Link
          href={`/dashboard/proposals/${live.id}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--white)",
            border: "1.5px solid #C9D0FB",
            borderRadius: 11,
            padding: "12px 14px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--cobalt-text)", flex: "none" }}>◆ View full proposal</span>
          <span style={{ flex: 1 }} />
          {live.selectedLabel && (
            <span className="kicker" style={{ flex: "none", fontSize: 9.5, padding: "3px 7px", borderRadius: 5, background: "#DCF5E3", color: "#15803D" }}>
              Option {live.selectedLabel}
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--cobalt-text)", flex: "none" }}>{STATUS_LABEL[live.status] ?? live.status} →</span>
        </Link>
      )}

      {live?.status === "declined" && (
        <div style={{ background: "#FBE3E3", border: "1px solid #F4CFCF", borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "#B91C1C", marginBottom: readOnly ? 0 : 10 }}>
          v{live.version} was declined{readOnly ? "." : " — start the next one below."}{" "}
          <Link href={`/dashboard/proposals/${live.id}`} style={{ color: "#B91C1C", fontWeight: 700 }}>Read it →</Link>
        </div>
      )}

      {needsCreate && canManage && !readOnly && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            onClick={() => setSetupOpen(true)}
            disabled={busy}
            style={{
              background: "var(--ink)",
              color: "var(--white)",
              border: "1px solid transparent",
              borderRadius: 11,
              padding: "16px 14px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>◆ Rough out a draft with AI</div>
            <div className="mono" style={{ fontSize: 9.5, color: "#aeb2bb", marginTop: 4 }}>
              one question, then shapes + prose{hasDiscovery ? " grounded in discovery" : ""}
            </div>
          </button>
          <button
            onClick={createBlank}
            disabled={busy}
            style={{
              background: "var(--white)",
              color: "var(--ink)",
              border: "1.5px dashed #d7d9df",
              borderRadius: 11,
              padding: "16px 14px",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>{busy ? "Creating…" : "+ Blank proposal"}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 4 }}>full manual entry — every field editable</div>
          </button>
        </div>
      )}

      {needsCreate && !canManage && !readOnly && <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No proposal yet.</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}

      {setupOpen && <ProposalSetupModal dealId={dealId} onClose={() => setSetupOpen(false)} />}
    </section>
  );
}
