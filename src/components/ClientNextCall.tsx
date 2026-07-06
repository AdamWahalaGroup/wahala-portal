"use client";

/**
 * Client portal · next call (frame 46) — cobalt-tinted card on the client project
 * page. Times shown in the CLIENT's timezone; Join gates at T−15 (same rule as
 * staff); "Add to calendar" is a plain .ics download (works with Outlook/Apple/
 * Google, no account needed — never a Google-only link); "ask to reschedule"
 * opens Messages to the account owner. No Google/Zoom branding — it's just your
 * call with Wahala.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/People";

const IMMINENT_MS = 15 * 60_000;

export function ClientNextCall({
  meetingId,
  title,
  startsAt,
  endsAt,
  videoUrl,
  accountOwnerName,
}: {
  meetingId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  videoUrl: string | null;
  accountOwnerName: string | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 45 * 60_000);
  const now = Date.now();
  if (now > end.getTime()) return null;
  const joinable = now >= start.getTime() - IMMINENT_MS;

  // The browser renders in the client's local timezone by definition.
  const whenLong = start.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  const whenShort = start.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

  return (
    <section style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 14, padding: "15px 18px", marginTop: 20 }}>
      <div className="kicker" style={{ color: "var(--cobalt-text)" }}>Your next call with Wahala</div>
      <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-.015em", marginTop: 6 }}>{title}</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
        {whenLong} <span style={{ color: "var(--muted-line)" }}>(your time)</span>
      </div>
      {accountOwnerName && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <Avatar name={accountOwnerName} size={26} variant="owner" />
          <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{accountOwnerName} will be on the call</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 9, alignItems: "center", marginTop: 13, flexWrap: "wrap" }}>
        {joinable && videoUrl ? (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            style={{ background: "var(--ink)", color: "var(--white)", borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}
          >
            Join call
          </a>
        ) : (
          <span style={{ background: "var(--surface)", color: "var(--muted)", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
            starts {whenShort}
          </span>
        )}
        <a
          href={`/api/meetings/${meetingId}/ics`}
          style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          Add to calendar
        </a>
        <Link
          href="/dashboard/messages"
          className="mono"
          style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}
        >
          ask to reschedule →
        </Link>
      </div>
    </section>
  );
}
