"use client";

/**
 * Contract room (R4) on the deal page — appears once a proposal is approved (or the
 * deal reached the contract stage). Commercials checklist, client portal invite,
 * and the Execute button: AI writes the SOW as a real project and the deal is won.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Item = { kind: string; label: string; status: "pending" | "signed"; signedAt: string | Date | null; note: string | null };

type Room = {
  available: boolean;
  items: Item[];
  approvedProposal: { id: string; title: string; optionLabel: string | null; optionName: string | null; priceCents: number | null } | null;
  clientInvited: boolean;
  contactEmail: string | null;
  contactName: string | null;
  project: { id: string; name: string } | null;
};

const btn = (tone: "ink" | "green" | "plain", disabled: boolean): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

export function ContractRoom({ dealId, room, canManage }: { dealId: string; room: Room; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmExecute, setConfirmExecute] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  if (!room.available) return null;

  async function call(url: string, body: unknown, key: string, method = "POST"): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { message?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        return null;
      }
      return data;
    } catch {
      setError("Network error — please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function toggleItem(item: Item) {
    const next = item.status === "signed" ? "pending" : "signed";
    const data = await call(`/api/deals/${dealId}/contract`, { item: { kind: item.kind, status: next } }, `item-${item.kind}`, "PATCH");
    if (data) router.refresh();
  }

  async function invite() {
    const data = await call(`/api/deals/${dealId}/contract/invite`, {}, "invite");
    if (data) {
      if (typeof data.inviteLink === "string") setInviteLink(data.inviteLink);
      setStatus("Invite sent ✓");
      router.refresh();
    }
  }

  async function execute() {
    setConfirmExecute(false);
    const data = await call(`/api/deals/${dealId}/contract/execute`, {}, "execute");
    if (data && typeof data.projectId === "string") {
      router.push(`/dashboard/projects/${data.projectId}`);
    }
  }

  const allSigned = room.items.every((i) => i.status === "signed");

  return (
    <section style={{ marginTop: 24, background: "var(--white)", border: "2px solid var(--ink)", borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div className="kicker">Contract room</div>
        {room.approvedProposal && (
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {room.approvedProposal.title}
            {room.approvedProposal.optionLabel ? ` · Option ${room.approvedProposal.optionLabel} — ${room.approvedProposal.optionName}` : ""}
            {room.approvedProposal.priceCents ? ` · $${(room.approvedProposal.priceCents / 100).toLocaleString()}` : ""}
          </span>
        )}
      </div>

      {/* Commercials checklist */}
      <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
        {room.items.map((i) => (
          <div key={i.kind} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-soft)", borderRadius: 9, padding: "9px 12px" }}>
            <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{i.status === "signed" ? "✅" : "☐"}</span>
            <span style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>{i.label}</span>
            {i.signedAt && (
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                signed {new Date(i.signedAt).toLocaleDateString()}
              </span>
            )}
            {canManage && (
              <button onClick={() => toggleItem(i)} disabled={busy !== null} style={btn("plain", busy !== null)}>
                {busy === `item-${i.kind}` ? "…" : i.status === "signed" ? "Undo" : "Mark signed"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Client invite */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {room.clientInvited ? (
          <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Client has portal access</span>
        ) : canManage && room.contactEmail ? (
          <>
            <button onClick={invite} disabled={busy !== null} style={btn("plain", busy !== null)}>
              {busy === "invite" ? "Inviting…" : `Invite ${room.contactName ?? "contact"} to the portal`}
            </button>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{room.contactEmail}</span>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            No contact email on file — add one to invite the client later.
          </span>
        )}
        {inviteLink && (
          <span className="mono" style={{ fontSize: 11, wordBreak: "break-all", color: "var(--muted)" }}>dev invite: {inviteLink}</span>
        )}
      </div>

      {/* Execute */}
      <div style={{ marginTop: 16, borderTop: "1px solid var(--border-soft)", paddingTop: 14 }}>
        {room.project ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#15803d" }}>✓ Contract executed —</span>
            <Link href={`/dashboard/projects/${room.project.id}`} style={{ fontSize: 13.5, fontWeight: 700 }}>
              {room.project.name} →
            </Link>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Quote phase 1 there; the pay-gates take it from here.</span>
          </div>
        ) : canManage ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => setConfirmExecute(true)} disabled={busy !== null} style={btn("green", busy !== null)}>
              {busy === "execute" ? "Writing SOW & creating project (~30s)…" : "◆ Execute contract → create project"}
            </button>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {allSigned ? "All commercials signed." : "Commercials still pending — you can execute anyway."}
            </span>
          </div>
        ) : null}
      </div>

      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "10px 0 0" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}

      {confirmExecute && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirmExecute(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 460, width: "100%", boxShadow: "var(--shadow-modal)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800 }}>Execute this contract?</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
              The AI writes the statement of work from the approved option + discovery as a real project —
              phases, focus areas, deliverables, no prices — and the deal is marked won. You&apos;ll land on the
              new project to review and quote phase 1.
              {!allSigned && " Some commercials are still unsigned — that's on you to chase."}
            </p>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setConfirmExecute(false)} style={btn("plain", false)}>Cancel</button>
              <button onClick={execute} style={btn("green", false)}>Execute →</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
