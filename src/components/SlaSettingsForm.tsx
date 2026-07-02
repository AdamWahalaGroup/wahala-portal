"use client";

/**
 * SLA & nudges editor (frame 28) — the thresholds that decide when the Board turns
 * something amber. They NUDGE, never block. Stuck window (global + per-stage),
 * probability anchors, and the lead-triage SLA are wired live; the follow-up SLAs and
 * nudge routing persist now and take effect when scheduled nudge delivery ships.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FUNNEL_STAGES, STAGE_META } from "@/domain/sales";
import { STAGE_COLORS } from "@/components/SalesChips";
import type { SlaSettings } from "@/domain/sla";

const card: React.CSSProperties = {
  background: "var(--white)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
};

const numInput: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 13,
  width: 68,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  background: "var(--white)",
};

function Days({ value, onChange, placeholder }: { value: number | ""; onChange: (v: number | "") => void; placeholder?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input
        className="mono"
        inputMode="numeric"
        style={numInput}
        value={value === "" ? "" : String(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw === "" ? "" : Math.min(365, parseInt(raw, 10)));
        }}
      />
      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}>days</span>
    </span>
  );
}

const kicker: React.CSSProperties = { fontSize: 9.5 };
const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="kicker" style={{ ...kicker, marginBottom: 5 }}>{children}</div>
);
const Reserved = () => (
  <span className="kicker" style={{ fontSize: 8.5, padding: "1px 6px", borderRadius: 5, background: "#FCEFDC", color: "#B45309", marginLeft: 8 }}>
    saved · enforced when nudges ship
  </span>
);

export function SlaSettingsForm({ settings, defaults }: { settings: SlaSettings; defaults: SlaSettings }) {
  const router = useRouter();
  const [s, setS] = useState<SlaSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<SlaSettings>) => {
    setS((cur) => ({ ...cur, ...p }));
    setSaved(false);
  };
  const num = (v: number | "", fallback: number) => (v === "" ? fallback : v);

  async function save(next?: SlaSettings) {
    const payload = next ?? s;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/slas", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        const data = (await res.json()) as { settings: SlaSettings };
        setS(data.settings);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setS(defaults);
    void save(defaults);
  }

  const stageRow = (
    stage: (typeof FUNNEL_STAGES)[number],
    render: (stage: (typeof FUNNEL_STAGES)[number]) => React.ReactNode,
  ) => (
    <div key={stage} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid var(--surface)" }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: STAGE_COLORS[stage], flex: "none" }} />
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{STAGE_META[stage].label}</span>
      {render(stage)}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
      {/* 1. Deal stuck window */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Deal stuck window</span>
          <span className="kicker" style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "#E8F7EE", color: "#15803D" }}>drives the ⚠ stuck tags</span>
        </div>
        <p style={{ margin: "5px 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
          A deal that hasn&apos;t moved stage in this many days flags ⚠ on the Board, tints its column, and
          counts in &quot;Stuck&quot;.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Label>Default</Label>
          <Days value={s.stuckWindowDays} onChange={(v) => patch({ stuckWindowDays: num(v, defaults.stuckWindowDays) })} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Label>Per-stage overrides (blank = use default)</Label>
          {FUNNEL_STAGES.map((stage) =>
            stageRow(stage, (st) => (
              <Days
                value={s.stuckPerStage[st] ?? ""}
                placeholder={String(s.stuckWindowDays)}
                onChange={(v) => {
                  const next = { ...s.stuckPerStage };
                  if (v === "") delete next[st];
                  else next[st] = v;
                  patch({ stuckPerStage: next });
                }}
              />
            )),
          )}
        </div>
      </div>

      {/* 2. Probability anchors */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Probability anchors</span>
          <span className="kicker" style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "#E8F7EE", color: "#15803D" }}>weighted pipeline · ≈N% close</span>
        </div>
        <p style={{ margin: "5px 0 8px", fontSize: 12.5, color: "var(--muted)" }}>
          Each stage&apos;s win-probability anchor. Feeds the weighted-pipeline figure and each column&apos;s
          &quot;≈N% close&quot; line. Blank = no anchor (weighs 50% in the rough weighted total).
        </p>
        {FUNNEL_STAGES.map((stage) =>
          stageRow(stage, (st) => {
            const v = s.probabilityAnchors[st];
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  className="mono"
                  inputMode="numeric"
                  style={numInput}
                  value={v === null || v === undefined ? "" : String(v)}
                  placeholder="—"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    const next = { ...s.probabilityAnchors };
                    next[st] = raw === "" ? null : Math.min(100, parseInt(raw, 10));
                    patch({ probabilityAnchors: next });
                  }}
                />
                <span className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}>%</span>
              </span>
            );
          }),
        )}
      </div>

      {/* 3. Response SLAs */}
      <div style={card}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Response SLAs</span>
        <p style={{ margin: "5px 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
          How long before something waiting turns amber.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Lead triage
                <span className="kicker" style={{ fontSize: 8.5, padding: "1px 6px", borderRadius: 5, background: "#E8F7EE", color: "#15803D", marginLeft: 8 }}>live on the board</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>New lead must be scored/qualified before its Triage card flags ⚠.</div>
            </div>
            <Days value={s.leadTriageDays} onChange={(v) => patch({ leadTriageDays: num(v, defaults.leadTriageDays) })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Proposal follow-up<Reserved /></div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Sent proposal with no client action prompts the owner.</div>
            </div>
            <Days value={s.proposalFollowupDays} onChange={(v) => patch({ proposalFollowupDays: num(v, defaults.proposalFollowupDays) })} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Client &quot;waiting on you&quot;<Reserved /></div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Delivery-side wait before the nudge escalates.</div>
            </div>
            <Days value={s.clientWaitingDays} onChange={(v) => patch({ clientWaitingDays: num(v, defaults.clientWaitingDays) })} />
          </div>
        </div>
      </div>

      {/* 4. Nudge routing */}
      <div style={card}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Nudge routing<Reserved /></span>
        <p style={{ margin: "5px 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
          Where nudges go once scheduled delivery is enabled.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={s.nudge.notifyOwnerInApp}
              onChange={(e) => patch({ nudge: { ...s.nudge, notifyOwnerInApp: e.target.checked } })}
            />
            Notify the deal owner in-app
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, flex: 1, minWidth: 180 }}>Admin digest</span>
            <select
              value={s.nudge.adminDigest}
              onChange={(e) => patch({ nudge: { ...s.nudge, adminDigest: e.target.value as SlaSettings["nudge"]["adminDigest"] } })}
              style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 9px", fontSize: 13, background: "var(--white)" }}
            >
              <option value="off">Off</option>
              <option value="monday">Monday morning</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flex: 1, minWidth: 180, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={s.nudge.escalateEmailDays !== null}
                onChange={(e) => patch({ nudge: { ...s.nudge, escalateEmailDays: e.target.checked ? 3 : null } })}
              />
              Escalate to email if unactioned
            </label>
            {s.nudge.escalateEmailDays !== null && (
              <Days value={s.nudge.escalateEmailDays} onChange={(v) => patch({ nudge: { ...s.nudge, escalateEmailDays: num(v, 3) } })} />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => save()}
          disabled={busy}
          style={{ background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={reset}
          disabled={busy}
          style={{ background: "var(--white)", color: "var(--ink-soft)", border: "1px solid #d7d9df", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}
        >
          Reset to defaults
        </button>
        {saved && <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Saved ✓ — live on the next Board load</span>}
        {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}
