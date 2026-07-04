"use client";

/**
 * Archive account (frame 14b redesigned) — SOFT: hides the account from active
 * lists and revokes portal access; deletes nothing; admins can restore. Type-to-
 * confirm kept from the old delete flow; the button is ink, not red. The old
 * cascade delete survives only as a dev script (deleteOrganization service).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveAccountButton({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const match = typed.trim() === name;

  async function archive() {
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
          setTyped("");
          setError(null);
        }}
        title="Archive account"
        aria-label={`Archive ${name}`}
        style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", padding: 4, fontSize: 14, lineHeight: 1, borderRadius: 6 }}
      >
        ⊟
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
            style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", boxShadow: "var(--shadow-modal)" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--surface)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              ⊟
            </div>
            <h3 style={{ margin: "16px 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>Archive this account?</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
              <strong>{name}</strong> disappears from active lists and its portal users lose access.{" "}
              <strong>Nothing is deleted</strong> — projects, deals, and history stay, and an admin can restore it any time
              (portal access stays revoked until re-invited).
            </p>
            <div className="kicker" style={{ margin: "14px 0 5px" }}>Type the account name to confirm</div>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 11px", fontSize: 13.5 }}
            />
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
                onClick={archive}
                disabled={busy || !match}
                style={{
                  borderRadius: 9,
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: match ? "var(--ink)" : "#B4B9C1",
                  color: "var(--white)",
                  border: "none",
                  cursor: busy || !match ? "default" : "pointer",
                }}
              >
                {busy ? "Archiving…" : "Archive account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Restore an archived account (admin) — back to Client (won deals) or Prospect. */
export function RestoreAccountButton({ orgId, name }: { orgId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      await fetch(`/api/clients/${orgId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={restore}
      disabled={busy}
      title={`Restore ${name}`}
      style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 4 }}
    >
      {busy ? "…" : "Restore"}
    </button>
  );
}
