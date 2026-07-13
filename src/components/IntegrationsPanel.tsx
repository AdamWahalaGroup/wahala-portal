"use client";

/**
 * Settings · Integrations (frame 47) + the guarded disconnect (frame 48).
 * Connect is easy and loud; disconnect is deliberate: a quiet underlined text
 * link → a modal with live consequences, an arming checkbox, "Keep connected"
 * as the focused primary, and a 30-second Undo after confirming (the token is
 * only revoked once the window lapses). Fixes the real accidental-disconnect.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type GoogleInfo = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  pendingDisconnect: boolean;
  upcomingCount: number;
};

const rel = (iso: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

export function IntegrationsPanel({ google, zoomConnected, isAdmin }: { google: GoogleInfo; zoomConnected: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [armed, setArmed] = useState(false);
  const [undoLeft, setUndoLeft] = useState<number | null>(null);
  const [zoomForm, setZoomForm] = useState(false);
  const [creds, setCreds] = useState({ accountId: "", clientId: "", clientSecret: "", secretToken: "", hostEmail: "" });
  const [error, setError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false); // Esc keeps the connection
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function syncNow() {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/sync", { method: "POST" });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { message?: string }).message ?? "Sync failed.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function confirmDisconnect() {
    setConfirming(false);
    setArmed(false);
    setBusy("disconnect");
    try {
      await fetch("/api/integrations/google", { method: "DELETE" }); // SOFT — token kept for Undo
      router.refresh();
      setUndoLeft(30);
      undoTimer.current = setInterval(() => {
        setUndoLeft((n) => {
          if (n === null) return null;
          if (n <= 1) {
            if (undoTimer.current) clearInterval(undoTimer.current);
            // Window lapsed — revoke for real.
            fetch("/api/integrations/google", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "revoke" }),
            }).finally(() => router.refresh());
            return null;
          }
          return n - 1;
        });
      }, 1000);
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndoLeft(null);
    await fetch("/api/integrations/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    router.refresh();
  }

  async function saveZoom() {
    setBusy("zoom");
    setError(null);
    try {
      const res = await fetch("/api/settings/integrations/zoom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creds),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        setZoomForm(false);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const input: React.CSSProperties = { border: "1px solid #d7d9df", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Google Calendar row */}
      <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flex: "none" }}>
          G
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 800 }}>Google Calendar</span>
            {google.connected ? (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "3px 10px" }}>Connected</span>
            ) : google.pendingDisconnect ? (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#FCEFDC", color: "#B45309", borderRadius: 999, padding: "3px 10px" }}>Disconnecting…</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#F1F2F4", color: "var(--muted)", borderRadius: 999, padding: "3px 10px" }}>Not connected</span>
            )}
          </div>
          {google.connected ? (
            <>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>
                {google.email} · connected {google.connectedAt ? new Date(google.connectedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "—"} · last sync {rel(google.lastSyncAt)} · {google.upcomingCount} upcoming event{google.upcomingCount === 1 ? "" : "s"} matched
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 2 }}>
                read &amp; write events · free/busy — nothing else
              </div>
            </>
          ) : (
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
              Your meetings on the objects they belong to, Join buttons, schedule-a-call from any deal, free/busy suggestions.
            </p>
          )}
        </div>
        {/* Actions column: Sync now on top; Disconnect… a quiet underlined text link BELOW it. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", flex: "none" }}>
          {google.connected ? (
            <>
              <button onClick={syncNow} disabled={busy !== null} style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
              <button
                onClick={() => setConfirming(true)}
                className="mono"
                style={{ border: 0, background: "none", color: "var(--muted-line)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                Disconnect…
              </button>
            </>
          ) : (
            <a href="/api/integrations/google/start" style={{ background: "var(--ink)", color: "var(--white)", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Connect Google Calendar
            </a>
          )}
        </div>
      </section>

      {/* Zoom row */}
      <section style={{ background: "var(--white)", border: zoomConnected ? "1px solid var(--border)" : "1.5px dashed #D7D9DF", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: "#E3ECFD", color: "#1D4ED8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flex: "none" }}>
          Zm
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800 }}>Zoom</span>
            {zoomConnected ? (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "3px 10px" }}>Connected</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#F1F2F4", color: "var(--muted)", borderRadius: 999, padding: "3px 10px" }}>Not connected</span>
            )}
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
            Join buttons on every card, a meeting link auto-attached when you schedule, recording → transcript → ◆ AI evidence analysis → human review.
          </p>
          {!zoomConnected && (
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>
              needs a company Zoom account (admin) · until then, paste links manually — cards show the &ldquo;no video link&rdquo; state
            </div>
          )}
          {zoomForm && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12, maxWidth: 420 }}>
              <input style={input} placeholder="Account ID *" value={creds.accountId} onChange={(e) => setCreds((c) => ({ ...c, accountId: e.target.value }))} />
              <input style={input} placeholder="Client ID *" value={creds.clientId} onChange={(e) => setCreds((c) => ({ ...c, clientId: e.target.value }))} />
              <input style={input} placeholder="Client Secret *" type="password" value={creds.clientSecret} onChange={(e) => setCreds((c) => ({ ...c, clientSecret: e.target.value }))} />
              <input style={input} placeholder="Webhook Secret Token" value={creds.secretToken} onChange={(e) => setCreds((c) => ({ ...c, secretToken: e.target.value }))} />
              <input style={input} placeholder="Fallback host email (optional)" value={creds.hostEmail} onChange={(e) => setCreds((c) => ({ ...c, hostEmail: e.target.value }))} />
              <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
                from marketplace.zoom.us → Build App → Server-to-Server OAuth · webhook endpoint: portal.wahala-services.com/api/webhooks/zoom
              </div>
              <button onClick={saveZoom} disabled={busy === "zoom"} style={{ alignSelf: "flex-start", background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {busy === "zoom" ? "Saving…" : "Save credentials"}
              </button>
            </div>
          )}
        </div>
        {isAdmin && !zoomForm && (
          <button
            onClick={() => setZoomForm(true)}
            style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}
          >
            {zoomConnected ? "Update credentials" : "Connect Zoom"}
          </button>
        )}
      </section>

      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: 0 }}>{error}</p>}

      {/* Undo toast (frame 48) */}
      {undoLeft !== null && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--white)", borderRadius: 12, padding: "12px 18px", display: "flex", gap: 14, alignItems: "center", boxShadow: "var(--shadow-modal)", zIndex: 90 }}>
          <span style={{ fontSize: 13 }}>Google Calendar disconnected.</span>
          <button onClick={undo} style={{ background: "var(--white)", color: "var(--ink)", border: 0, borderRadius: 8, padding: "6px 13px", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
            Undo ({undoLeft}s)
          </button>
        </div>
      )}

      {/* Guarded confirm (frame 48) */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 85, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 480, padding: "22px 24px" }}>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>Disconnect Google Calendar?</h3>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>{google.email}</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <div style={{ background: "#FFF7ED", border: "1px solid #FADCB4", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "#92400E" }}>
                ⚠ <b>{google.upcomingCount} upcoming meeting{google.upcomingCount === 1 ? "" : "s"} stop syncing</b> — cards keep their last-known time but go stale, marked &ldquo;unsynced&rdquo;.
              </div>
              <div style={{ background: "var(--surface-soft)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "var(--ink-soft)" }}>
                &ldquo;Schedule call&rdquo; and free/busy suggestions turn off everywhere.
              </div>
              <div style={{ background: "#F4FBF7", border: "1px solid #D6EFE4", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "#15803D" }}>
                ✓ Nothing is deleted — past digests, transcripts and deal history stay. Reconnecting restores sync.
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={armed} onChange={(e) => setArmed(e.target.checked)} style={{ accentColor: "#B91C1C" }} />
              I understand meetings will stop syncing
            </label>

            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                onClick={confirmDisconnect}
                disabled={!armed}
                style={{
                  borderRadius: 9,
                  padding: "10px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: "var(--white)",
                  color: armed ? "#B91C1C" : "#E5B3B3",
                  border: `1px solid ${armed ? "#E08A8A" : "#F0CACA"}`,
                  cursor: armed ? "pointer" : "default",
                }}
              >
                Disconnect
              </button>
              <button
                ref={keepRef}
                onClick={() => setConfirming(false)}
                style={{ borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, background: "var(--ink)", color: "var(--white)", border: 0, cursor: "pointer" }}
              >
                Keep connected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
