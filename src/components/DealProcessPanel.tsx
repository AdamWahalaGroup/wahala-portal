"use client";

/**
 * Deal process panel (frame 38) — the training layer + the Discovery Package data.
 * Training mode is a LAYER on the real deal view, never a parallel UI: the goal
 * rail, explain callouts, and next-best-action card render only when it's on; the
 * package card and recorded calls are real deal data and always render (the explain
 * strings become tooltips when training is off).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EXPLAIN, PACKAGE_FIELD_LABELS, type PackageFields } from "@/domain/process";
import { PACKAGE_FIELDS } from "@/db/schema";

type Call = { id: string; title: string; recordedAt: string; durationMin: number | null; fieldsExtracted: number };
type NextAction = { n: number; text: string; active: boolean };

const TONE = {
  green: { bg: "#DCF5E3", fg: "#15803D" },
  amber: { bg: "#FCEFDC", fg: "#B45309" },
  red: { bg: "#FBE3E3", fg: "#B91C1C" },
} as const;

export function ReadyPill({ score, tone }: { score: number | null; tone: "green" | "amber" | "red" }) {
  const c = TONE[tone];
  return (
    <span className="mono" style={{ fontSize: 10, fontWeight: 800, background: c.bg, color: c.fg, borderRadius: 999, padding: "3px 10px" }}>
      {score === null ? "NOT SCORED" : `READY ${score.toFixed(1)}/10`}
    </span>
  );
}

function Explain({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--cobalt-wash)", border: "1px solid #DDE1FB", borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, background: "var(--cobalt)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flex: "none", marginTop: 1 }}>
        ?
      </span>
      <p style={{ margin: 0, fontSize: 12, color: "#2536C4", lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

/** Goal rail (top of the deal view, training mode only). */
export function GoalRail({ goal, journey, journeyIndex }: { goal: string; journey: { key: string; label: string }[]; journeyIndex: number }) {
  return (
    <div style={{ background: "#EEF0FE", borderBottom: "1px solid #DDE1FB", borderRadius: 10, padding: "9px 13px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "var(--cobalt)", color: "var(--white)", borderRadius: 5, padding: "2px 7px", flex: "none" }}>
        TRAINING
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#2536C4", flex: 1, minWidth: 180 }}>{goal}</span>
      <span className="mono" style={{ fontSize: 9.5, color: "#5A6BD8", flex: "none" }}>
        step {journeyIndex + 1} of {journey.length} ·{" "}
        {journey.map((s, i) => (i === journeyIndex ? "you are here" : s.label)).join(" → ")}
      </span>
    </div>
  );
}

export function DealProcessPanel({
  dealId,
  canManage,
  trainingMode,
  readiness,
  tone,
  fields,
  nextActions,
  calls,
  openLog = 0,
}: {
  dealId: string;
  canManage: boolean;
  trainingMode: boolean;
  readiness: number | null;
  tone: "green" | "amber" | "red";
  fields: PackageFields;
  nextActions: NextAction[];
  calls: Call[];
  /** Bump to force the "Log a call" form open (the drawer footer's Log button). */
  openLog?: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", duration: "", transcript: "" });
  const [openTranscript, setOpenTranscript] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (openLog > 0) setAdding(true);
  }, [openLog]);

  async function ingest() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/calls`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          transcriptMd: form.transcript,
          durationMin: form.duration ? Math.round(parseFloat(form.duration)) : undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string; readiness?: number; fieldsExtracted?: number };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        setStatus(`Extracted — ${d.fieldsExtracted ?? 0} fields improved · readiness ${d.readiness?.toFixed(1)}/10`);
        setAdding(false);
        setForm({ title: "", duration: "", transcript: "" });
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function showTranscript(callId: string) {
    if (openTranscript?.id === callId) {
      setOpenTranscript(null);
      return;
    }
    const res = await fetch(`/api/deals/${dealId}/calls/${callId}`);
    const d = (await res.json().catch(() => ({}))) as { transcriptMd?: string };
    setOpenTranscript({ id: callId, text: d.transcriptMd ?? "(transcript unavailable)" });
  }

  const fieldRow = (key: (typeof PACKAGE_FIELDS)[number]) => {
    const f = fields[key];
    const s = f?.status ?? "missing";
    const c = s === "ok" ? TONE.green : s === "partial" ? TONE.amber : TONE.red;
    return (
      <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0" }}>
        <span style={{ width: 16, height: 16, borderRadius: 999, background: c.bg, color: c.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800, flex: "none", marginTop: 1 }}>
          {s === "ok" ? "✓" : s === "partial" ? "–" : "✕"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{PACKAGE_FIELD_LABELS[key]}</div>
          {f?.evidence && (
            <div className="mono" style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {f.evidence}
              {f.source ? ` · ${f.source}` : ""}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Discovery package card */}
      <section
        style={{ background: "var(--white)", border: trainingMode ? "1.5px solid var(--cobalt)" : "1px solid var(--border)", borderRadius: 12, padding: 14 }}
        title={trainingMode ? undefined : EXPLAIN.whyCompleteness}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span className="kicker">Discovery package</span>
          <span style={{ marginLeft: "auto" }}>
            <ReadyPill score={readiness} tone={tone} />
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 14 }}>{PACKAGE_FIELDS.map(fieldRow)}</div>
        {trainingMode && (
          <div style={{ marginTop: 10 }}>
            <Explain text={EXPLAIN.whyCompleteness} />
          </div>
        )}
      </section>

      {/* Next best action (training mode only) */}
      {trainingMode && nextActions.length > 0 && (
        <section style={{ background: "var(--ink)", borderRadius: 12, padding: "14px 15px" }}>
          <div className="kicker" style={{ color: "#8b909a", marginBottom: 10 }}>Next best action</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {nextActions.map((a) => (
              <div key={a.n} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  className="mono"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: a.active ? "var(--cobalt)" : "#2c2f36",
                    color: a.active ? "var(--white)" : "#8b909a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    flex: "none",
                    marginTop: 1,
                  }}
                >
                  {a.n}
                </span>
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: a.active ? "var(--white)" : "#8b909a", fontWeight: a.active ? 600 : 500 }}>
                  {a.text}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recorded calls (the past — "Log = past") */}
      <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="kicker">Recorded calls ({calls.length})</span>
          {canManage && (
            <button
              onClick={() => setAdding((v) => !v)}
              style={{ marginLeft: "auto", border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {adding ? "cancel" : "+ log a call"}
            </button>
          )}
        </div>
        {adding && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 7 }}>
              <input
                style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, flex: 1 }}
                placeholder="Call title (e.g. Discovery call 2)"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
              <input
                className="mono"
                style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12.5, width: 74 }}
                placeholder="min"
                inputMode="numeric"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value.replace(/[^0-9]/g, "") }))}
              />
            </div>
            <textarea
              style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 12, minHeight: 90, fontFamily: "inherit", lineHeight: 1.45 }}
              placeholder="Paste the transcript — the package fills itself (~20s)."
              value={form.transcript}
              onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
            />
            <button
              onClick={ingest}
              disabled={busy || !form.title.trim() || !form.transcript.trim()}
              style={{ alignSelf: "flex-start", background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              {busy ? "Extracting package fields (~20s)…" : "◆ Ingest call"}
            </button>
          </div>
        )}
        {status && <p style={{ color: "#15803d", fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>{status}</p>}
        {error && <p style={{ color: "#b00020", fontSize: 12, margin: "0 0 8px" }}>{error}</p>}
        {calls.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-line)" }}>No calls yet — paste the first transcript and the package fills itself.</p>
        ) : (
          calls.map((c) => (
            <div key={c.id} style={{ borderBottom: "1px solid var(--border-softer)", padding: "7px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16A34A", flex: "none" }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{c.title}</span>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", flex: "none" }}>
                  {new Date(c.recordedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                  {c.durationMin ? ` · ${Math.floor(c.durationMin / 60) > 0 ? `${Math.floor(c.durationMin / 60)}h` : ""}${c.durationMin % 60}m` : ""}
                  {` · ${c.fieldsExtracted} fields extracted`}
                </span>
                <button onClick={() => showTranscript(c.id)} className="mono" style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 10, fontWeight: 700, cursor: "pointer", flex: "none" }}>
                  {openTranscript?.id === c.id ? "hide" : "transcript →"}
                </button>
              </div>
              {openTranscript?.id === c.id && (
                <pre className="mono" style={{ margin: "8px 0 2px", fontSize: 10.5, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "#FBFBFC", border: "1px solid #EDEDF1", borderRadius: 8, padding: "9px 11px", maxHeight: 260, overflowY: "auto" }}>
                  {openTranscript.text}
                </pre>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/** Explain callout for the stage chip area (training mode) / tooltip source (off). */
export function StagesVsGatesCallout() {
  return <Explain text={EXPLAIN.stagesVsGates} />;
}
