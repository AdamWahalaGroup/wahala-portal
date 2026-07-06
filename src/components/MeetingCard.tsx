"use client";

/**
 * MeetingCard (frame 43) — ONE component, five states, used on the deal drawer,
 * staff home, and the client project page:
 *   upcoming → imminent (T−15m) → live → ended · awaiting recording → digest ready
 * imminent/live are computed from the client clock (same T−15 gate for staff and
 * clients). Missing integrations degrade LOUDLY: where Join would sit, a dashed
 * "no video link" row with connect/paste actions — never an absent button.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type MeetingCardData = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  videoUrl: string | null;
  status: "upcoming" | "ended" | "awaiting_recording" | "digest_ready";
  attendees: { email: string; name: string | null; response: string | null }[];
  createdByName?: string | null;
  synced: boolean;
  callId?: string | null;
  dealId?: string | null;
};

const IMMINENT_MS = 15 * 60_000;

function useClockState(m: MeetingCardData): "upcoming" | "imminent" | "live" | "past" {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();
  const start = new Date(m.startsAt).getTime();
  const end = m.endsAt ? new Date(m.endsAt).getTime() : start + 45 * 60_000;
  if (now >= end) return "past";
  if (now >= start) return "live";
  if (now >= start - IMMINENT_MS) return "imminent";
  return "upcoming";
}

function fmtCountdown(startsAt: string): string {
  const mins = Math.max(0, Math.round((new Date(startsAt).getTime() - Date.now()) / 60_000));
  return mins >= 60 ? `in ${Math.floor(mins / 60)}h ${mins % 60}m` : `in ${mins} min`;
}

const fmtWhen = (iso: string, endIso: string | null) => {
  const s = new Date(iso);
  const day = s.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const t1 = s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const t2 = endIso ? new Date(endIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  return `${day} · ${t1}${t2 ? `–${t2}` : ""}`;
};

/** The dashed no-video row (frame 43·3) — never an absent button. */
export function NoVideoRow({ meetingId, canEdit }: { meetingId: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoUrl: url }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(d.message ?? "Failed.");
      else {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px dashed #D7D9DF", borderRadius: 8, padding: "7px 10px", marginTop: 8 }}>
      {editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            autoFocus
            className="mono"
            style={{ border: "1px solid #d7d9df", borderRadius: 7, padding: "5px 8px", fontSize: 11, flex: 1, minWidth: 0 }}
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <button onClick={save} disabled={busy || !url.trim()} style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flex: "none" }}>
            Save
          </button>
        </div>
      ) : (
        <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
          no video link yet —{" "}
          <Link href="/dashboard/settings/integrations" style={{ color: "var(--cobalt-text)", fontWeight: 700, textDecoration: "none" }}>
            connect Zoom
          </Link>{" "}
          to add Join
          {canEdit && (
            <>
              {" · or "}
              <button onClick={() => setEditing(true)} style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 9.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                paste a link
              </button>
            </>
          )}
        </span>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 11, margin: "5px 0 0" }}>{error}</p>}
    </div>
  );
}

export function MeetingCard({ meeting, canEdit, showAttendees = true }: { meeting: MeetingCardData; canEdit: boolean; showAttendees?: boolean }) {
  const clock = useClockState(meeting);
  const done = meeting.status === "ended" || meeting.status === "awaiting_recording" || meeting.status === "digest_ready" || clock === "past";
  const imminent = !done && (clock === "imminent" || clock === "live");

  const border = imminent ? "1.5px solid var(--cobalt)" : "1px solid #E7E8EC";
  const bg = imminent ? "#FAFBFF" : "var(--white)";
  const dot = done
    ? meeting.status === "digest_ready"
      ? "#16A34A"
      : "#C4C8CF"
    : clock === "live"
      ? "#D97706"
      : imminent
        ? "var(--cobalt)"
        : "#C4C8CF";

  const invited = meeting.attendees.filter((a) => a.email);
  const accepted = invited.filter((a) => a.response === "accepted");

  return (
    <div style={{ border, background: bg, borderRadius: 11, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: dot, flex: "none", boxShadow: imminent ? "0 0 0 4px var(--cobalt-wash)" : undefined }} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meeting.title}</span>
        {meeting.synced && (
          <span className="mono" style={{ fontSize: 8.5, fontWeight: 700, background: "var(--cobalt-wash)", color: "#2536C4", border: "1px solid #DDE1FB", borderRadius: 999, padding: "2px 8px", flex: "none" }}>
            synced · Google Calendar
          </span>
        )}
      </div>
      <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
        {fmtWhen(meeting.startsAt, meeting.endsAt)}
        {meeting.createdByName ? ` · set by ${meeting.createdByName.split(" ")[0]}` : ""}
        {clock === "live" && !done && <b style={{ color: "#B45309" }}> · live now</b>}
        {clock === "imminent" && <b style={{ color: "var(--cobalt-text)" }}> · {fmtCountdown(meeting.startsAt)}</b>}
      </div>
      {showAttendees && invited.length > 0 && (
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 3 }}>
          {invited.length} invited
          {accepted.length > 0 ? ` · ${accepted.map((a) => (a.name ?? a.email).split(" ")[0]).join(", ")} accepted` : " · invite sent"}
        </div>
      )}

      {/* Action zone by state */}
      {!done &&
        (meeting.videoUrl ? (
          <div style={{ display: "flex", gap: 8, marginTop: 9, alignItems: "center" }}>
            {imminent ? (
              <a
                href={meeting.videoUrl}
                target="_blank"
                rel="noreferrer"
                style={{ background: "var(--cobalt)", color: "var(--white)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
              >
                Join {meeting.videoUrl.includes("zoom.us") ? "Zoom" : "call"} →
              </a>
            ) : (
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>Join appears 15 min before start</span>
            )}
            <button
              onClick={() => navigator.clipboard?.writeText(meeting.videoUrl ?? "")}
              className="mono"
              style={{ border: "1px solid #E2E3E8", background: "var(--white)", color: "var(--muted)", borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >
              Copy {imminent ? "link" : "invite"}
            </button>
          </div>
        ) : (
          <NoVideoRow meetingId={meeting.id} canEdit={canEdit} />
        ))}

      {done && (
        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
          {meeting.status === "digest_ready" ? (
            <>
              <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "2px 9px" }}>
                digest ready
              </span>
              {meeting.dealId && (
                <Link href={`/dashboard/sales/deals/${meeting.dealId}`} className="mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}>
                  ◆ AI digest →
                </Link>
              )}
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>merged into deal facts</span>
            </>
          ) : meeting.status === "awaiting_recording" ? (
            <span className="mono" style={{ fontSize: 9, fontWeight: 700, background: "#F1F2F4", color: "var(--muted)", borderRadius: 999, padding: "2px 9px" }}>
              ⟳ awaiting recording
            </span>
          ) : (
            <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
              ended{meeting.callId ? "" : " · paste the transcript on the deal to run the digest"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
