"use client";

/**
 * Admin scorecard (frame 41) — one row card per admin, all math from
 * process_events. "Outcomes lag; process health leads." Renders as a full-screen
 * layer over the persistent board (the sales layout keeps the board mounted
 * behind child segments). Max-2 signals band at the bottom: a conversation
 * starter, not a surveillance wall.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/People";

type Row = {
  userId: string;
  name: string;
  trainingMode: boolean;
  openDeals: number;
  openValueCents: number;
  won: number;
  lost: number;
  winRatePct: number | null;
  readinessAtAdvance: number | null;
  nudgeResponsePct: number | null;
  overrides: number;
  overridesBeforeLoss: number;
  avgDaysBetweenMoves: number | null;
  signal: { tone: "green" | "amber" | "cobalt"; label: string };
};
type Signal = { tone: "amber" | "green"; title: string; body: string };

const fmtK = (cents: number) => {
  const d = Math.round(cents / 100);
  return d >= 1000 ? `$${Math.round(d / 1000)}k` : `$${d}`;
};

const SIGNAL_TONE = {
  green: { bg: "#DCF5E3", fg: "#15803D" },
  amber: { bg: "#FCEFDC", fg: "#B45309" },
  cobalt: { bg: "#EEF0FE", fg: "#2536C4" },
} as const;

function Bar({ value, max, ok }: { value: number; max: number; ok: boolean }) {
  return (
    <span style={{ display: "block", width: 64, height: 4, borderRadius: 999, background: "#EDEDF1", marginTop: 5 }}>
      <span style={{ display: "block", width: `${Math.min(100, (value / max) * 100)}%`, height: 4, borderRadius: 999, background: ok ? "#16A34A" : "#D97706" }} />
    </span>
  );
}

export function TeamScorecard({ rows, signals, currentUserId }: { rows: Row[]; signals: Signal[]; currentUserId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/dashboard/sales", { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  async function toggleTraining(userId: string, on: boolean) {
    setBusy(userId);
    try {
      await fetch("/api/settings/training", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, on }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const cell = (label: string, main: React.ReactNode, sub?: React.ReactNode) => (
    <div style={{ minWidth: 0 }}>
      <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>{main}</div>
      {sub}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--surface-soft)", zIndex: 70, overflowY: "auto" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 32px 60px" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--muted-line)", display: "flex", gap: 14 }}>
          <Link href="/dashboard/sales" style={{ color: "var(--cobalt-text)", textDecoration: "none", fontWeight: 700 }}>
            ← Board
          </Link>
          <span>sales / team</span>
          <span style={{ marginLeft: "auto" }}>Esc closes</span>
        </div>

        <div className="kicker" style={{ marginTop: 18 }}>Sales · Team</div>
        <h1 style={{ margin: "6px 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>Process scorecard</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
          Outcomes lag; process health leads. Every number below comes from the process event log — no gut feel.
        </p>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
          {rows.map((r) => {
            const st = SIGNAL_TONE[r.signal.tone];
            return (
              <div
                key={r.userId}
                style={{
                  background: "var(--white)",
                  border: r.trainingMode ? "1.5px dashed var(--cobalt)" : "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "grid",
                  gridTemplateColumns: "1.5fr 0.8fr 1fr 1fr 1fr 0.8fr 0.9fr",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                {/* Identity */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar name={r.name} size={34} variant="lead" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, display: "flex", alignItems: "center", gap: 7 }}>
                      {r.name}
                      {r.trainingMode && (
                        <span className="mono" style={{ fontSize: 8, fontWeight: 800, background: "var(--cobalt)", color: "var(--white)", borderRadius: 4, padding: "1px 6px" }}>
                          TRAINING
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>
                      {r.openDeals} open · {fmtK(r.openValueCents)}
                    </div>
                    {r.userId !== currentUserId && (
                      <button
                        onClick={() => toggleTraining(r.userId, !r.trainingMode)}
                        disabled={busy === r.userId}
                        className="mono"
                        style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 9, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 2 }}
                      >
                        {busy === r.userId ? "…" : r.trainingMode ? "turn training off" : "turn training on"}
                      </button>
                    )}
                  </div>
                </div>

                {cell(
                  "Won / lost",
                  <>
                    <span style={{ color: "#15803D" }}>{r.won}</span>
                    <span style={{ color: "var(--muted-line)" }}> / </span>
                    <span style={{ color: "#B91C1C" }}>{r.lost}</span>
                  </>,
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>{r.winRatePct !== null ? `${r.winRatePct}% win` : "—"}</div>,
                )}

                {cell(
                  "Readiness at advance",
                  r.readinessAtAdvance !== null ? `${r.readinessAtAdvance.toFixed(1)}/10` : "—",
                  r.readinessAtAdvance !== null ? <Bar value={r.readinessAtAdvance} max={10} ok={r.readinessAtAdvance >= 7} /> : undefined,
                )}

                {cell(
                  "Nudge response",
                  r.nudgeResponsePct !== null ? `${r.nudgeResponsePct}%` : "—",
                  r.nudgeResponsePct !== null ? <Bar value={r.nudgeResponsePct} max={100} ok={r.nudgeResponsePct >= 80} /> : undefined,
                )}

                {cell(
                  "Overrides",
                  r.overrides,
                  <div className="mono" style={{ fontSize: 9.5, color: r.overridesBeforeLoss > 0 ? "#B45309" : "var(--muted-line)" }}>
                    {r.overrides === 0 ? "—" : r.overridesBeforeLoss > 0 ? `${r.overridesBeforeLoss} preceded losses` : "justified · won"}
                  </div>,
                )}

                {cell("Avg days / move", r.avgDaysBetweenMoves !== null ? `${r.avgDaysBetweenMoves}d` : "—")}

                <div style={{ justifySelf: "end" }}>
                  <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: st.bg, color: st.fg, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap" }}>
                    {r.signal.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Signals band — max 2, conversation starters */}
        {signals.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: signals.length > 1 ? "1fr 1fr" : "1fr", gap: 12, marginTop: 20 }}>
            {signals.map((s, i) => {
              const c = s.tone === "amber" ? { bg: "#FFF7ED", border: "#FADCB4", fg: "#92400E" } : { bg: "#F4FBF7", border: "#D6EFE4", fg: "#15803D" };
              return (
                <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "13px 15px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: c.fg }}>{s.title}</div>
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: c.fg, lineHeight: 1.5 }}>{s.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
