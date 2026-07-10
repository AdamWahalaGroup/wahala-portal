"use client";

/**
 * NDA strip for the deal drawer, Discovery onward (founder call, 10 Jul): the NDA
 * protects the discovery conversations, so it surfaces the moment work starts —
 * not at Committed with the rest of the paper. Same one-row / pill-fills-in-place
 * language as the agreement package; the row itself is account-level, so signing
 * here is what the Committed package later shows as already done.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const pillStyle = (tone: "plain" | "green" | "amber", disabled: boolean): React.CSSProperties => ({
  border: tone === "green" ? "1px solid #BFE6CC" : tone === "amber" ? "1px solid #FADCB4" : "1px solid #D7D9DF",
  background: tone === "green" ? "#DCF5E3" : tone === "amber" ? "#FCEFDC" : "var(--white)",
  color: tone === "green" ? "#15803D" : tone === "amber" ? "#B45309" : "var(--muted)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 11,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  flex: "none",
});

export function NdaStrip({
  agreement,
  orgId,
  canManage,
}: {
  agreement: { id: string; status: "needed" | "sent" | "signed" | "n_a"; signedAt: string | null };
  orgId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signed = agreement.status === "signed";

  async function setStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/${agreement.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: signed ? "#FBFBFC" : "var(--white)",
        border: signed ? "1px solid #EEF0F2" : "1px solid #E7E8EC",
        borderRadius: 10,
        padding: "9px 12px",
        flexWrap: "wrap",
      }}
    >
      {signed ? (
        <span style={{ width: 18, height: 18, borderRadius: 999, background: "#DCF5E3", color: "#15803D", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none" }}>✓</span>
      ) : (
        <span style={{ width: 18, height: 18, borderRadius: 999, border: "1.5px solid #D7D9DF", flex: "none" }} />
      )}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5 }}>Mutual NDA</div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
          {signed
            ? `signed${agreement.signedAt ? ` ${new Date(agreement.signedAt).toLocaleDateString("en-US", { day: "2-digit", month: "short" })}` : ""} — discovery conversations are covered`
            : agreement.status === "sent"
              ? "sent · waiting on signature"
              : "protects what you're about to share — get it signed before discovery goes deep"}
        </div>
      </div>
      <Link href={`/dashboard/accounts/${orgId}/nda`} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
        View doc →
      </Link>
      {canManage && (
        <div style={{ display: "flex", gap: 7, flex: "none", alignItems: "center" }}>
          {!signed && (
            <button
              onClick={() => void setStatus(agreement.status === "sent" ? "needed" : "sent")}
              disabled={busy}
              title={agreement.status === "sent" ? "Sent — click to undo" : "Mark as sent"}
              style={pillStyle(agreement.status === "sent" ? "amber" : "plain", busy)}
            >
              {agreement.status === "sent" ? "✓ Sent" : "Send"}
            </button>
          )}
          <button
            onClick={() => void setStatus(signed ? "needed" : "signed")}
            disabled={busy}
            title={signed ? "Signed — click to undo" : "Mark as signed"}
            style={pillStyle(signed ? "green" : "plain", busy)}
          >
            {signed ? "✓ Signed" : "Signed"}
          </button>
        </div>
      )}
      {error && <span style={{ color: "#b00020", fontSize: 11.5, width: "100%" }}>{error}</span>}
    </div>
  );
}
