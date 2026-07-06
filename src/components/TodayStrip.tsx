"use client";

/**
 * Staff home today strip + meeting inbox (frame 45).
 * Strip: ONE row — the current/next matched meeting, the rest of the day
 * compressed to a mono line, Join only when imminent. Hides on meeting-free days.
 * Inbox: synced events that didn't auto-match — one-click link when there's a
 * suggestion, a picker otherwise, and "Not client work" (teaches the matcher).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StripMeeting = {
  id: string;
  title: string;
  startsAt: string;
  videoUrl: string | null;
  dealId: string | null;
  dealName: string | null;
};

const IMMINENT_MS = 15 * 60_000;

export function TodayStrip({ meetings }: { meetings: StripMeeting[] }) {
  const router = useRouter();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (meetings.length === 0) return null; // hides entirely on meeting-free days

  const [first, ...rest] = meetings;
  const start = new Date(first.startsAt).getTime();
  const now = Date.now();
  const imminent = now >= start - IMMINENT_MS && now < start + 90 * 60_000;
  const mins = Math.max(0, Math.round((start - now) / 60_000));
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 16px", marginTop: 14, flexWrap: "wrap" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: imminent ? "var(--cobalt)" : "#C4C8CF", flex: "none", boxShadow: imminent ? "0 0 0 4px var(--cobalt-wash)" : undefined }} />
      <button
        onClick={() => first.dealId && router.push(`/dashboard/sales/deals/${first.dealId}`, { scroll: false })}
        style={{ border: 0, background: "none", fontSize: 13.5, fontWeight: 800, cursor: first.dealId ? "pointer" : "default", padding: 0, color: "inherit" }}
      >
        {first.title}
      </button>
      <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: imminent ? "var(--cobalt-text)" : "var(--muted)" }}>
        {t(first.startsAt)}
        {imminent && now < start ? ` · in ${mins} min` : imminent ? " · live now" : ""}
      </span>
      {rest.length > 0 && (
        <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)", flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          then {rest.map((m) => `${t(m.startsAt)} ${m.dealName ?? m.title}`).join(" · ")}
        </span>
      )}
      {imminent && first.videoUrl && (
        <a
          href={first.videoUrl}
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto", background: "var(--cobalt)", color: "var(--white)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, textDecoration: "none", flex: "none" }}
        >
          Join
        </a>
      )}
    </div>
  );
}

type InboxItem = {
  id: string;
  title: string;
  startsAt: string;
  reason: string | null;
  suggestedOrganizationId: string | null;
  suggestedOrgName: string | null;
  hasTranscript: boolean;
};
type DealOption = { id: string; name: string; orgName: string };

export function MeetingInbox({ items, deals }: { items: InboxItem[]; deals: DealOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [dealId, setDealId] = useState(deals[0]?.id ?? "");

  if (items.length === 0) return null;

  async function act(id: string, path: string, body?: unknown) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        setChoosing(null);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ marginTop: 12, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="kicker">Meeting inbox</span>
        <span className="tabular" style={{ fontSize: 10, fontWeight: 800, background: "var(--cobalt-wash)", color: "#2536C4", borderRadius: 999, padding: "1px 8px" }}>
          {items.length}
        </span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--muted-line)" }}>synced events that didn&apos;t match a deal</span>
      </div>
      {items.map((m) => (
        <div key={m.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--border-softer)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0 }}>{m.title}</span>
            <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
              {new Date(m.startsAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {m.hasTranscript ? " · transcript held" : ""}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8, flex: "none" }}>
              {m.suggestedOrganizationId && (
                <button
                  onClick={() => act(m.id, `/api/meetings/${m.id}/link`, { organizationId: m.suggestedOrganizationId })}
                  disabled={busy === m.id}
                  style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {busy === m.id ? "…" : `Link to ${m.suggestedOrgName ?? "account"}`}
                </button>
              )}
              <button
                onClick={() => setChoosing((v) => (v === m.id ? null : m.id))}
                style={{ background: "var(--white)", color: "var(--ink-soft)", border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Choose deal…
              </button>
              <button
                onClick={() => act(m.id, `/api/meetings/${m.id}/suppress`)}
                disabled={busy === m.id}
                title="Removes it and teaches the matcher"
                style={{ background: "var(--white)", color: "var(--muted)", border: "1px solid #E2E3E8", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Not client work
              </button>
            </span>
          </div>
          {m.reason && (
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>{m.reason}</div>
          )}
          {choosing === m.id && (
            <div style={{ display: "flex", gap: 7, marginTop: 7, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "6px 8px", fontSize: 12, flex: "1 1 240px", background: "var(--white)" }}
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.orgName} — {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => act(m.id, `/api/meetings/${m.id}/link`, { dealId })}
                disabled={busy === m.id || !dealId}
                style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {busy === m.id ? (m.hasTranscript ? "Linking + digesting…" : "Linking…") : "Link"}
              </button>
            </div>
          )}
        </div>
      ))}
      {error && <p style={{ color: "#b00020", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}
