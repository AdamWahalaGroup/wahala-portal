"use client";

/**
 * Schedule a call (frame 44) — from the deal drawer footer. Creates a Google
 * Calendar event on the member's calendar, lives on this deal, becomes its next
 * step. Zoom is optional: toggle disabled until the company Zoom is connected,
 * with a dashed paste-a-link fallback. "Schedule = future · Log = past."
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ContactChip = { id: string; name: string; email: string | null };
type Slot = { startsAt: string; label: string };

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--white)",
  boxSizing: "border-box",
};

export function ScheduleCallModal({
  dealId,
  dealName,
  accountName,
  orgId,
  memberEmail,
  zoomReady,
  calendarConnected,
  onClose,
}: {
  dealId: string;
  dealName: string;
  accountName: string;
  orgId: string;
  memberEmail: string;
  zoomReady: boolean;
  calendarConnected: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactChip[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [title, setTitle] = useState(`${dealName} — ${accountName} × Wahala`);
  const [when, setWhen] = useState(""); // ISO from a slot chip, or from the manual input
  const [manualWhen, setManualWhen] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [duration, setDuration] = useState(45);
  const [editDuration, setEditDuration] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/accounts/${orgId}/contacts`)
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((raw) => {
        const d = raw as { contacts?: { id: string; name: string; email: string | null; isPrimary?: boolean }[] };
        const list = (d.contacts ?? []).map((c) => ({ id: c.id, name: c.name, email: c.email }));
        setContacts(list);
        const primary = (d.contacts ?? []).find((c) => c.isPrimary && c.email);
        if (primary) setPicked({ [primary.id]: true });
      })
      .catch(() => setContacts([]));
    fetch(`/api/integrations/google/slots?duration=45`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((raw) => setSlots(((raw as { slots?: Slot[] }).slots ?? []).slice(0, 3)))
      .catch(() => setSlots([]));
  }, [orgId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effectiveWhen = when || (manualWhen ? new Date(manualWhen).toISOString() : "");

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/meetings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          startsAt: effectiveWhen,
          durationMin: duration,
          contactIds: Object.keys(picked).filter((id) => picked[id]),
          sendInvite,
          videoUrl: !zoomReady && videoUrl.trim() ? videoUrl.trim() : undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const invitedNames = contacts.filter((c) => picked[c.id]).map((c) => c.name.split(" ")[0]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 85, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "6vh 16px" }}
    >
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 540, padding: "20px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>Schedule a call</h2>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>
              creates a Google Calendar event on {memberEmail} · lives on this deal
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 16, cursor: "pointer", padding: 2 }}>
            ×
          </button>
        </div>

        {!calendarConnected && (
          <div style={{ background: "#FFF7ED", border: "1px solid #FADCB4", borderRadius: 10, padding: "10px 13px", marginTop: 14, fontSize: 12.5, color: "#92400E" }}>
            Connect your Google Calendar first — the event is created on <b>your</b> calendar.{" "}
            <a href="/api/integrations/google/start" style={{ color: "var(--cobalt-text)", fontWeight: 700 }}>Connect →</a>
          </div>
        )}

        {/* Title */}
        <div style={{ marginTop: 14 }}>
          <div className="kicker" style={{ marginBottom: 5 }}>Title</div>
          <input style={{ ...inputStyle, width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* With */}
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>With</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {contacts.length === 0 && <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}>no contacts on this account yet</span>}
            {contacts.map((c) =>
              c.email ? (
                <button
                  key={c.id}
                  onClick={() => setPicked((m) => ({ ...m, [c.id]: !m[c.id] }))}
                  style={{
                    border: `1px solid ${picked[c.id] ? "#BFE6CC" : "#E2E3E8"}`,
                    background: picked[c.id] ? "#DCF5E3" : "var(--white)",
                    color: picked[c.id] ? "#15803D" : "#5A6069",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {picked[c.id] ? "✓ " : ""}
                  {c.name}
                </button>
              ) : (
                <span key={c.id} className="mono" title="Add an email on the Account page to invite" style={{ border: "1px dashed #FADCB4", background: "#FFF7ED", color: "#B45309", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "5px 11px" }}>
                  ⚠ {c.name} — add email
                </span>
              ),
            )}
          </div>
        </div>

        {/* When */}
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>
            When <span style={{ textTransform: "none", letterSpacing: 0 }}>— from your free/busy · {duration} min{" "}
            {editDuration ? (
              <input
                autoFocus
                className="mono"
                style={{ ...inputStyle, width: 56, padding: "2px 6px", fontSize: 11 }}
                inputMode="numeric"
                defaultValue={duration}
                onBlur={(e) => {
                  setDuration(Math.max(15, Math.min(480, Math.round(Number(e.target.value) || 45))));
                  setEditDuration(false);
                }}
              />
            ) : (
              <button onClick={() => setEditDuration(true)} style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                change
              </button>
            )}
            </span>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {slots === null ? (
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}>checking your calendar…</span>
            ) : (
              slots.map((s) => (
                <button
                  key={s.startsAt}
                  onClick={() => {
                    setWhen(s.startsAt);
                    setShowManual(false);
                  }}
                  style={{
                    border: `1.5px solid ${when === s.startsAt ? "var(--cobalt)" : "#E2E3E8"}`,
                    background: when === s.startsAt ? "var(--cobalt-wash)" : "var(--white)",
                    color: when === s.startsAt ? "#2536C4" : "#5A6069",
                    borderRadius: 9,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {s.label}
                </button>
              ))
            )}
            <button
              onClick={() => {
                setShowManual(true);
                setWhen("");
              }}
              style={{ border: "1px solid #E2E3E8", background: "var(--white)", color: "var(--muted)", borderRadius: 9, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              pick a time…
            </button>
          </div>
          {showManual && (
            <input type="datetime-local" style={{ ...inputStyle, marginTop: 8 }} value={manualWhen} onChange={(e) => setManualWhen(e.target.value)} />
          )}
        </div>

        {/* Video */}
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Video</div>
          {zoomReady ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 28, height: 16, borderRadius: 999, background: "var(--cobalt)", position: "relative", flex: "none" }}>
                <span style={{ position: "absolute", top: 2, left: 14, width: 12, height: 12, borderRadius: 999, background: "var(--white)" }} />
              </span>
              Zoom meeting attached automatically · recording + evidence analysis run after the call
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted-line)" }}>
                <span style={{ width: 28, height: 16, borderRadius: 999, background: "#E2E3E8", position: "relative", flex: "none" }}>
                  <span style={{ position: "absolute", top: 2, left: 2, width: 12, height: 12, borderRadius: 999, background: "var(--white)" }} />
                </span>
                Zoom <span className="mono" style={{ fontSize: 10 }}>— connect Zoom in Settings to enable · recording + evidence analysis need this</span>
              </div>
              <input
                className="mono"
                style={{ ...inputStyle, width: "100%", marginTop: 7, border: "1px dashed #D7D9DF", fontSize: 11.5 }}
                placeholder="…or paste a meeting link for now"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </>
          )}
        </div>

        {/* Invite toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5 }}>
          <input type="checkbox" checked={sendInvite} onChange={(e) => setSendInvite(e.target.checked)} style={{ accentColor: "#2B3EE6" }} />
          Send Google invite{invitedNames.length ? ` to ${invitedNames.join(", ")}` : ""}
          {!sendInvite && <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>· hold on your calendar only</span>}
        </label>

        {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
          <button
            onClick={create}
            disabled={busy || !effectiveWhen || !title.trim() || !calendarConnected}
            style={{
              background: effectiveWhen && calendarConnected ? "var(--ink)" : "#B4B9C1",
              color: "var(--white)",
              border: 0,
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {busy ? "Creating…" : "Create event"}
          </button>
          <button onClick={onClose} disabled={busy} style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>becomes the deal&apos;s next step</span>
        </div>
      </div>
    </div>
  );
}
