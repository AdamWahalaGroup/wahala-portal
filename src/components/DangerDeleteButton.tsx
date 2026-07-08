"use client";

/**
 * DEV TOOL — a small trash affordance with an "are you sure" dialog, for hard
 * deletes while building (contacts/leads, accounts). Admin-only pages render
 * it; the API enforces admin again. Deliberately quiet chrome: dev cleanup,
 * not a product feature — the product path is archive/pass.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DangerDeleteButton({
  endpoint,
  title,
  body,
  redirectTo,
  label = "delete",
}: {
  /** DELETE is sent here. */
  endpoint: string;
  title: string;
  body: string;
  /** Where to land after a successful delete. */
  redirectTo: string;
  /** Trigger text next to the trash glyph. */
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`${title} (dev tool)`}
        className="mono"
        style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, flex: "none" }}
      >
        🗑 {label}
      </button>

      {open && (
        <div
          onClick={() => (busy ? undefined : setOpen(false))}
          style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-label={title}
            style={{ background: "var(--white)", borderRadius: 14, padding: "22px 24px", maxWidth: 420, width: "100%", boxShadow: "var(--shadow-modal)" }}
          >
            <div className="mono" style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".1em", color: "#B91C1C", marginBottom: 6 }}>DEV TOOL · IRREVERSIBLE</div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</h3>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>{body}</p>
            {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "10px 0 0" }}>{error}</p>}
            <div style={{ display: "flex", gap: 9, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={destroy}
                disabled={busy}
                style={{ background: "#B91C1C", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
