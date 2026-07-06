"use client";

/**
 * StaffHome Meetings card (Zoom + Calendar round, no design frame yet — kept
 * modest): connect CTA when Google Calendar isn't linked; next events with Join
 * buttons when it is; and the unmatched-transcripts inbox with one-click attach
 * (transcript → deal_calls → extractor → readiness).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventRow = { id: string; title: string; start: string; joinUrl: string | null; allDay: boolean };
type UnmatchedRow = { id: string; topic: string; startsAt: string | null; durationMin: number | null };
type DealOption = { id: string; name: string; orgName: string };

export function MeetingsCard({
  connected,
  email,
  events,
  unmatched,
  deals,
  canManage,
}: {
  connected: boolean;
  email: string | null;
  events: EventRow[];
  unmatched: UnmatchedRow[];
  deals: DealOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [dealId, setDealId] = useState(deals[0]?.id ?? "");

  async function disconnect() {
    setBusy("disconnect");
    try {
      await fetch("/api/integrations/google", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function attach(meetingId: string) {
    setBusy(meetingId);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attach`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string; readiness?: number };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        setAttaching(null);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  const fmtTime = (iso: string, allDay: boolean) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    return allDay ? day : `${day} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  };

  return (
    <section style={{ marginTop: 16, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="kicker">Meetings</span>
        {connected ? (
          <>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>{email}</span>
            <button
              onClick={disconnect}
              disabled={busy === "disconnect"}
              className="mono"
              style={{ marginLeft: "auto", border: 0, background: "none", color: "var(--muted-line)", fontSize: 10, cursor: "pointer" }}
            >
              disconnect
            </button>
          </>
        ) : (
          <a
            href="/api/integrations/google/start"
            style={{ marginLeft: "auto", background: "var(--ink)", color: "var(--white)", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
          >
            Connect Google Calendar
          </a>
        )}
      </div>

      {!connected ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>
          See your meetings here with Join buttons — and portal-scheduled Zoom calls land on your calendar automatically.
        </p>
      ) : events.length === 0 ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted-line)" }}>Nothing upcoming on your calendar.</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {events.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-softer)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: e.joinUrl ? "var(--cobalt)" : "#C4C8CF", flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", flex: "none" }}>{fmtTime(e.start, e.allDay)}</span>
              {e.joinUrl && (
                <a
                  href={e.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ flex: "none", background: "var(--cobalt)", color: "var(--white)", borderRadius: 7, padding: "5px 12px", fontSize: 11.5, fontWeight: 700, textDecoration: "none" }}
                >
                  Join
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unmatched transcripts inbox */}
      {unmatched.length > 0 && (
        <div style={{ marginTop: 14, border: "1px solid #FADCB4", background: "#FFF7ED", borderRadius: 10, padding: "10px 13px" }}>
          <div className="kicker" style={{ color: "#B45309", marginBottom: 6 }}>
            Unmatched call transcripts ({unmatched.length})
          </div>
          {unmatched.map((m) => (
            <div key={m.id} style={{ padding: "6px 0", borderBottom: "1px solid #FCEFDC" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{m.topic}</span>
                <span className="mono" style={{ fontSize: 9.5, color: "#B45309", flex: "none" }}>
                  {m.startsAt ? new Date(m.startsAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : ""}
                  {m.durationMin ? ` · ${m.durationMin}m` : ""}
                </span>
                {canManage && (
                  <button
                    onClick={() => setAttaching(attaching === m.id ? null : m.id)}
                    style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flex: "none" }}
                  >
                    {attaching === m.id ? "cancel" : "attach →"}
                  </button>
                )}
              </div>
              {attaching === m.id && (
                <div style={{ display: "flex", gap: 7, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    value={dealId}
                    onChange={(e) => setDealId(e.target.value)}
                    style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 12, flex: "1 1 220px", background: "var(--white)" }}
                  >
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.orgName} — {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => attach(m.id)}
                    disabled={busy === m.id || !dealId}
                    style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flex: "none" }}
                  >
                    {busy === m.id ? "Attaching + extracting…" : "Attach to deal"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {error && <p style={{ color: "#b00020", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
