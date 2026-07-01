"use client";

/**
 * Discovery Package panel (R2): paste a transcript → AI distills/merges the package;
 * the markdown stays fully editable and saves to the deal. "Most of this knowledge
 * is lost after the meeting" — not with our system, it won't be.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  lineHeight: 1.55,
  resize: "vertical",
};

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
  const [md, setMd] = useState(discoveryMd ?? "");
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(!discoveryMd);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!canManage && !discoveryMd) return null;

  async function generate() {
    setBusy("generate");
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
        discoveryMd?: string;
        usage?: { costCents: number; model: string };
      };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setMd(data.discoveryMd ?? "");
        setPaste("");
        setShowPaste(false);
        setStatus(
          data.usage ? `Distilled with ${data.usage.model} · ≈ $${(data.usage.costCents / 100).toFixed(2)}` : "Distilled.",
        );
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discoveryMd: md }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setStatus("Saved ✓");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <div className="kicker">Discovery package</div>
        {canManage && (
          <button
            onClick={() => setShowPaste((v) => !v)}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 600 }}
          >
            {showPaste ? "hide transcript box" : md ? "+ add another transcript" : "+ paste a transcript"}
          </button>
        )}
      </div>

      {canManage && showPaste && (
        <div style={{ background: "#F5F7FF", border: "1px solid #D9E0F5", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <textarea
            style={{ ...inputStyle, minHeight: 140, background: "var(--white)" }}
            placeholder="Paste the call transcript or meeting notes here. The AI distills it into the package below — business profile, workflow, goals, pain points, decision makers, their terminology, open questions. Re-paste after every call; it merges."
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button
              onClick={generate}
              disabled={busy !== null || !paste.trim()}
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
              {busy === "generate" ? "Distilling…" : md ? "◆ Distill & merge" : "◆ Distill discovery"}
            </button>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>≈ $0.03 per pass · nothing leaves the deal</span>
          </div>
        </div>
      )}

      {(md || canManage) && (
        <div>
          <textarea
            style={{ ...inputStyle, minHeight: md ? 320 : 120 }}
            placeholder="No discovery captured yet. Paste a transcript above, or write the package by hand."
            value={md}
            onChange={(e) => setMd(e.target.value)}
            readOnly={!canManage}
          />
          {canManage && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button
                onClick={save}
                disabled={busy !== null || md === (discoveryMd ?? "")}
                style={{
                  background: "var(--white)",
                  color: "var(--ink)",
                  border: "1px solid #d7d9df",
                  borderRadius: 8,
                  padding: "8px 15px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  opacity: md === (discoveryMd ?? "") ? 0.5 : 1,
                }}
              >
                {busy === "save" ? "Saving…" : "Save edits"}
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Wins carry this into the client&apos;s AI memory automatically.
              </span>
            </div>
          )}
        </div>
      )}

      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "8px 0 0" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}
