"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin-only client delete: trash action → destructive confirm modal. */
export function DeleteClientButton({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${orgId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        title="Delete client"
        aria-label={`Delete ${name}`}
        style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, fontSize: 15, lineHeight: 1, borderRadius: 6 }}
      >
        🗑
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-modal)" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fbe3e3", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              🗑
            </div>
            <h3 style={{ margin: "16px 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>Delete this client?</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
              This permanently removes <strong>{name}</strong> and <strong>all of its projects, stages, tasks, and history</strong>. It can&apos;t be undone. (Its Wahala account owner isn&apos;t affected.)
            </p>
            {error && <p style={{ color: "#b00020", fontSize: 13.5, marginTop: 12, marginBottom: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 600, background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={del}
                disabled={busy}
                style={{ borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 600, background: "#b91c1c", color: "var(--white)", border: "none", cursor: busy ? "default" : "pointer" }}
              >
                {busy ? "Deleting…" : "Delete client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
