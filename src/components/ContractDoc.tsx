"use client";

/**
 * Contract / SOW document (HANDOFF-DELTA-2026-07-07 §5). Fixed section order —
 * toggles decide whether a section is NEEDED, never its position (§5.5, no
 * drag-and-drop). Bullet lists are flat one-per-line textareas by design.
 * Draft = live-editable autosave; Sent/Executed = the WHOLE body locks via one
 * wrapper (pointer-events + opacity), never per-field readOnly. Executed is
 * terminal: changes only as appended amendment-log entries.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Money } from "@/components/Money";
import { paymentSchedule, acceptanceSentence } from "@/domain/proposal-math";
import type { ContractPhase, ProposalContract } from "@/domain/proposal-doc";

const CONTRACT_STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "#4b5159", bg: "#f1f2f4" },
  sent: { label: "Sent for signature", fg: "#6d28d9", bg: "#f1ebfe" },
  executed: { label: "Executed", fg: "#15803d", bg: "#dcf5e3" },
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--white)",
  color: "var(--ink)",
  boxSizing: "border-box",
  width: "100%",
};
const areaStyle: React.CSSProperties = { ...inputStyle, minHeight: 74, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
const btn = (tone: "ink" | "green" | "plain", disabled = false): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 9,
  padding: "9px 15px",
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

function Section({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 17px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: "var(--muted-line)" }}>{String(n).padStart(2, "0")}</span>
        <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: "-.01em" }}>{title}</span>
        <span style={{ marginLeft: "auto" }}>{aside}</span>
      </div>
      {children}
    </section>
  );
}

function TogglePill({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        borderRadius: 999,
        padding: "4px 12px",
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: ".06em",
        background: on ? "#DCF5E3" : "#F1F2F4",
        color: on ? "#15803D" : "#767B85",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {on ? "INCLUDED" : "OFF"}
    </button>
  );
}

export function ContractDoc({
  proposalId,
  organizationName,
  contract,
  contractStale,
  canManage,
}: {
  proposalId: string;
  organizationName: string;
  contract: ProposalContract;
  contractStale: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(contract);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [amendNote, setAmendNote] = useState("");

  const isDraft = c.status === "draft" && canManage;
  const locked = !isDraft;
  const sched = paymentSchedule(c);
  const meta = CONTRACT_STATUS_META[c.status];

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function api(path: string, method: string, body?: unknown): Promise<boolean> {
    try {
      const res = await fetch(path, {
        method,
        headers: body !== undefined ? { "content-type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        return false;
      }
      setError(null);
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  /** Local update + debounced autosave of the whole editable document. */
  function patch(next: Partial<ProposalContract>) {
    const merged = { ...c, ...next };
    setC(merged);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void api(`/api/proposals/${proposalId}/contract`, "PATCH", {
        scopeOfEngagement: merged.scopeOfEngagement,
        phases: merged.phases,
        depositPct: merged.depositPct,
        outOfScopeEnabled: merged.outOfScopeEnabled,
        outOfScopeText: merged.outOfScopeText,
        changeManagementEnabled: merged.changeManagementEnabled,
        changeManagementText: merged.changeManagementText,
        acceptanceReviewDays: merged.acceptanceReviewDays,
        clientSignerName: merged.clientSignerName,
        clientSignerTitle: merged.clientSignerTitle,
        ourSignerName: merged.ourSignerName,
        ourSignerTitle: merged.ourSignerTitle,
      }).then((ok) => {
        if (ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }
      });
    }, 700);
  }

  function patchPhase(i: number, p: Partial<ContractPhase>) {
    patch({ phases: c.phases.map((ph, j) => (j === i ? { ...ph, ...p } : ph)) });
  }

  async function setStatus(to: "draft" | "sent" | "executed") {
    setBusy(to);
    const ok = await api(`/api/proposals/${proposalId}/contract/status`, "POST", { to });
    setBusy(null);
    if (ok) {
      setC((v) => ({ ...v, status: to }));
      router.refresh();
    }
  }

  const multi = c.phases.length > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Statement of work</h1>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
            {c.proposalNumber} · prepared for {organizationName}
          </div>
        </div>
        {saved && <span className="mono" style={{ fontSize: 10, color: "#15803d" }}>saved ✓</span>}
        <span className="kicker" style={{ fontSize: 10, padding: "4px 11px", borderRadius: 999, background: meta.bg, color: meta.fg }}>{meta.label}</span>
        {canManage && c.status === "draft" && (
          <button onClick={() => void setStatus("sent")} disabled={busy !== null} style={btn("ink", busy !== null)}>
            Mark sent for signature →
          </button>
        )}
        {canManage && c.status === "sent" && (
          <>
            <button onClick={() => void setStatus("executed")} disabled={busy !== null} style={btn("green", busy !== null)}>
              ✓ Mark executed
            </button>
            <button onClick={() => void setStatus("draft")} disabled={busy !== null} style={btn("plain", busy !== null)}>
              Revert to draft
            </button>
          </>
        )}
      </div>

      {/* Staleness banner — draft only */}
      {contractStale && c.status === "draft" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF7ED", border: "1px solid #FADCB4", borderLeft: "4px solid #D97706", borderRadius: 10, padding: "10px 13px", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#B45309", flex: 1, minWidth: 200 }}>
            ⚠ The proposal has changed since this was generated.
          </span>
          <button
            onClick={() =>
              void (async () => {
                setBusy("resync");
                const ok = await api(`/api/proposals/${proposalId}/contract/resync`, "POST");
                setBusy(null);
                if (ok) router.refresh();
              })()
            }
            disabled={busy === "resync"}
            style={{ ...btn("plain", busy === "resync"), borderColor: "#D97706", color: "#B45309" }}
          >
            {busy === "resync" ? "Resyncing…" : "Resync phases"}
          </button>
        </div>
      )}

      {error && <p style={{ color: "#b00020", fontSize: 13, margin: 0 }}>{error}</p>}

      {/* THE document body — one lock wrapper, never per-field readOnly (§5.3 note) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, pointerEvents: locked ? "none" : undefined, opacity: locked ? 0.6 : 1 }}>
        <Section n={1} title="Scope of Engagement">
          <textarea value={c.scopeOfEngagement} onChange={(e) => patch({ scopeOfEngagement: e.target.value })} style={areaStyle} />
        </Section>

        <Section n={2} title="Statement of Work">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {c.phases.map((ph, i) => (
              <div key={i} style={{ border: "1px solid var(--border-softer)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 13.5, flex: "1 1 160px" }}>
                    {multi ? `Phase ${i + 1} — ` : ""}{ph.name}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>$</span>
                  <input
                    value={ph.amountCents > 0 ? String(ph.amountCents / 100) : ""}
                    onChange={(e) => patchPhase(i, { amountCents: Math.round(parseFloat(e.target.value.replace(/[^0-9.]/g, "")) * 100) || 0 })}
                    inputMode="numeric"
                    style={{ ...inputStyle, width: 96, fontWeight: 800 }}
                  />
                  {ph.weeks !== null && (
                    <>
                      <input
                        value={String(ph.weeks)}
                        onChange={(e) => patchPhase(i, { weeks: Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0) })}
                        inputMode="numeric"
                        style={{ ...inputStyle, width: 52 }}
                      />
                      <span className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>weeks</span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div className="kicker" style={{ fontSize: 9.5, marginBottom: 4 }}>Objective</div>
                    <input value={ph.objective} onChange={(e) => patchPhase(i, { objective: e.target.value })} style={inputStyle} />
                  </div>
                  {(["scopeText", "deliverablesText", "acceptanceText"] as const).map((k) => (
                    <div key={k}>
                      <div className="kicker" style={{ fontSize: 9.5, marginBottom: 4 }}>
                        {k === "scopeText" ? "Scope of work" : k === "deliverablesText" ? "Deliverables" : "Acceptance criteria"}
                        <span style={{ color: "var(--muted-line)", textTransform: "none", letterSpacing: 0 }}> · one item per line</span>
                      </div>
                      <textarea value={ph[k]} onChange={(e) => patchPhase(i, { [k]: e.target.value } as Partial<ContractPhase>)} style={{ ...areaStyle, minHeight: 58 }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section n={3} title="Project Timeline">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["Phase", "Duration", "Price"].map((h) => (
                  <th key={h} className="kicker" style={{ textAlign: h === "Phase" ? "left" : "right", fontSize: 9.5, padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.phases.map((ph, i) => (
                <tr key={i}>
                  <td style={{ padding: "7px 6px", borderBottom: "1px solid var(--border-softer)", fontWeight: 600 }}>{multi ? `Phase ${i + 1} — ${ph.name}` : ph.name}</td>
                  <td className="mono tabular" style={{ padding: "7px 6px", borderBottom: "1px solid var(--border-softer)", textAlign: "right" }}>{ph.weeks !== null ? `${ph.weeks} weeks` : "—"}</td>
                  <td className="tabular" style={{ padding: "7px 6px", borderBottom: "1px solid var(--border-softer)", textAlign: "right", fontWeight: 700 }}><Money cents={ph.amountCents} /></td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "8px 6px", fontWeight: 800 }}>Total</td>
                <td className="mono tabular" style={{ padding: "8px 6px", textAlign: "right" }}>{c.phases.every((p) => p.weeks !== null) ? `${c.phases.reduce((n, p) => n + (p.weeks ?? 0), 0)} weeks` : ""}</td>
                <td className="tabular" style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}><Money cents={sched.totalCents} /></td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section
          n={4}
          title="Payment Schedule"
          aside={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <input
                value={String(c.depositPct)}
                onChange={(e) => patch({ depositPct: Math.min(100, Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0)) })}
                inputMode="numeric"
                style={{ ...inputStyle, width: 48, textAlign: "right" }}
              />
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>% deposit</span>
            </span>
          }
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {sched.rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ padding: "7px 6px", borderBottom: "1px solid var(--border-softer)", fontWeight: 600 }}>{r.label}</td>
                  <td className="tabular" style={{ padding: "7px 6px", borderBottom: "1px solid var(--border-softer)", textAlign: "right", fontWeight: 700 }}><Money cents={r.amountCents} /></td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "8px 6px", fontWeight: 800 }}>Total Contract Value</td>
                <td className="tabular" style={{ padding: "8px 6px", textAlign: "right", fontWeight: 800 }}><Money cents={sched.totalCents} /></td>
              </tr>
            </tbody>
          </table>
          <p className="mono" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--muted-line)" }}>
            deposit due at contract execution · phase 1&apos;s acceptance payment is reduced by the deposit already collected
          </p>
        </Section>

        <Section n={5} title="Out of Scope" aside={<TogglePill on={c.outOfScopeEnabled} onClick={() => patch({ outOfScopeEnabled: !c.outOfScopeEnabled })} disabled={locked} />}>
          {c.outOfScopeEnabled ? (
            <textarea value={c.outOfScopeText} onChange={(e) => patch({ outOfScopeText: e.target.value })} style={areaStyle} />
          ) : (
            <p className="mono" style={{ margin: 0, fontSize: 11, color: "var(--muted-line)" }}>off — not part of this document</p>
          )}
        </Section>

        <Section n={6} title="Change Management" aside={<TogglePill on={c.changeManagementEnabled} onClick={() => patch({ changeManagementEnabled: !c.changeManagementEnabled })} disabled={locked} />}>
          {c.changeManagementEnabled ? (
            <textarea value={c.changeManagementText} onChange={(e) => patch({ changeManagementText: e.target.value })} style={areaStyle} />
          ) : (
            <p className="mono" style={{ margin: 0, fontSize: 11, color: "var(--muted-line)" }}>off — not part of this document</p>
          )}
        </Section>

        <Section n={7} title="Acceptance">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <input
              value={String(c.acceptanceReviewDays)}
              onChange={(e) => patch({ acceptanceReviewDays: Math.min(60, Math.max(1, parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 1)) })}
              inputMode="numeric"
              style={{ ...inputStyle, width: 52, textAlign: "right" }}
            />
            <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>business-day review window</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.55 }}>{acceptanceSentence(c.clientSignerName || organizationName, c.acceptanceReviewDays)}</p>
        </Section>

        <Section n={8} title="Signatures">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {(
              [
                { who: organizationName, name: "clientSignerName", title: "clientSignerTitle" },
                { who: "Wahala Group", name: "ourSignerName", title: "ourSignerTitle" },
              ] as const
            ).map((col) => (
              <div key={col.who} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <div className="kicker" style={{ fontSize: 9.5 }}>{col.who}</div>
                <input value={c[col.name]} onChange={(e) => patch({ [col.name]: e.target.value } as Partial<ProposalContract>)} placeholder="Name" style={inputStyle} />
                <input value={c[col.title]} onChange={(e) => patch({ [col.title]: e.target.value } as Partial<ProposalContract>)} placeholder="Title" style={inputStyle} />
                <div className="mono" style={{ fontSize: 11, color: "var(--muted)", paddingTop: 8 }}>Signature ________________&nbsp;&nbsp;Date ________</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Amendment log — OUTSIDE the lock wrapper; executed only. Never unlock fields. */}
      {c.status === "executed" && (
        <section style={{ background: "var(--white)", border: "1.5px solid #C9D0FB", borderRadius: 12, padding: "15px 17px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 14.5 }}>Amendment log</span>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>a change order is a new entry, never an edit to the executed original</span>
          </div>
          {c.amendments.length === 0 ? (
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted-line)" }}>No amendments logged.</p>
          ) : (
            <div style={{ marginBottom: 10 }}>
              {c.amendments.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--border-softer)" }}>
                  <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", flex: "none" }}>
                    {new Date(a.at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: 12.5 }}>{a.note}</span>
                </div>
              ))}
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={amendNote}
                onChange={(e) => setAmendNote(e.target.value)}
                placeholder="Describe the change order…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() =>
                  void (async () => {
                    setBusy("amend");
                    const ok = await api(`/api/proposals/${proposalId}/contract/amendments`, "POST", { note: amendNote });
                    setBusy(null);
                    if (ok) {
                      setC((v) => ({ ...v, amendments: [...v.amendments, { note: amendNote.trim(), at: new Date().toISOString() }] }));
                      setAmendNote("");
                    }
                  })()
                }
                disabled={busy === "amend" || !amendNote.trim()}
                style={btn("ink", busy === "amend" || !amendNote.trim())}
              >
                {busy === "amend" ? "Logging…" : "Log amendment"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
