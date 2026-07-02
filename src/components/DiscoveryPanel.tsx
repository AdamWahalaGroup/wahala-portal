"use client";

/**
 * Discovery Package panel (frames 24): rendered markdown by default with Edit/Save
 * (MarkdownPanel), plus the paste-a-transcript → "◆ Distill & merge" flow.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkdownPanel } from "@/components/MarkdownPanel";

export function DiscoveryPanel({
  dealId,
  discoveryMd,
  canManage,
}: {
  dealId: string;
  discoveryMd: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(!discoveryMd && canManage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!canManage && !discoveryMd) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/discovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pastedText: paste }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        usage?: { costCents: number; model: string };
      };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setPaste("");
        setShowPaste(false);
        setStatus(data.usage ? `Distilled with ${data.usage.model} · ≈ $${(data.usage.costCents / 100).toFixed(2)}` : "Distilled.");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits(next: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discoveryMd: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        return data.message ?? `Failed (${res.status}).`;
      }
      router.refresh();
      return null;
    } catch {
      return "Network error — please try again.";
    }
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <div className="kicker">Discovery package</div>
        {canManage && (
          <button
            onClick={() => setShowPaste((v) => !v)}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 600 }}
          >
            {showPaste ? "hide transcript box" : discoveryMd ? "+ paste a transcript" : "+ paste a transcript"}
          </button>
        )}
      </div>

      {canManage && showPaste && (
        <div style={{ background: "#F5F7FF", border: "1px solid #D9E0F5", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <textarea
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #d7d9df",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.55,
              minHeight: 130,
              resize: "vertical",
              background: "var(--white)",
              fontFamily: "inherit",
            }}
            placeholder="Paste the call transcript or meeting notes. The AI distills it into the package — re-paste after every call; it merges."
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button
              onClick={generate}
              disabled={busy || !paste.trim()}
              style={{
                background: "var(--ink)",
                color: "var(--white)",
                border: "none",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
                opacity: !paste.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Distilling… ~20s" : discoveryMd ? "◆ Distill & merge" : "◆ Distill discovery"}
            </button>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>≈ $0.03 per pass</span>
          </div>
        </div>
      )}

      <MarkdownPanel
        value={discoveryMd ?? ""}
        editable={canManage}
        onSave={saveEdits}
        placeholder="No discovery captured yet — paste a transcript above, or Edit to write it by hand."
        maxHeight={560}
      />
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Wins carry this into the client&apos;s AI memory automatically.
      </p>
      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "8px 0 0" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}
