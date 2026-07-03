"use client";

/**
 * Capture contact modal (frame 32) — "one record forever — lead is a state, not a
 * thing". Name + optional email, an Account combobox (typeahead over existing
 * accounts, inline "+ create new"), source, gut-call value, the intake note, and the
 * qualification quick-check: 2+ of Real need / Budget signal / Decision maker opens
 * the fast lane — "Start deal → Discovery" bypasses Triage (logged as a bypass).
 * "Save to Triage" is always available; unchecked contacts go to Triage for scoring.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type AccountOption = { id: string; name: string; state: string };

const CHECKS = ["Real need", "Budget signal", "Decision maker"] as const;

const SOURCES = ["Referral", "Website form", "Event", "Cold outreach", "Existing account", "Reddit / social", "Other"];

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 9,
  padding: "9px 11px",
  fontSize: 13.5,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = { marginBottom: 5 };

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const stateLabel = (s: string) => (s === "active" ? "client" : s === "archived" ? "past client" : "prospect");

export function ContactCaptureModal({ canStartDeal, onClose }: { canStartDeal: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [form, setForm] = useState({ name: "", email: "", source: "", value: "", notes: "" });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  // Account combobox state: either an existing account is picked, or a free-text
  // name will create one inline ("+ create new").
  const [accountQuery, setAccountQuery] = useState("");
  const [picked, setPicked] = useState<AccountOption | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((raw) => {
        const d = raw as { clients?: { org: { id: string; name: string; status: string } }[] };
        setAccounts((d.clients ?? []).map((c) => ({ id: c.org.id, name: c.org.name, state: stateLabel(c.org.status) })));
      })
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = useMemo(() => {
    const q = accountQuery.trim().toLowerCase();
    const list = q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : accounts;
    return list.slice(0, 6);
  }, [accountQuery, accounts]);

  const checkedN = CHECKS.filter((c) => checks[c]).length;
  const fastLane = checkedN >= 2;
  const hasAccount = !!picked || (createNew && accountQuery.trim().length > 0);
  const canSubmitDeal = canStartDeal && fastLane && hasAccount && !!form.name.trim();

  async function submit(qualifyNow: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          organizationId: picked?.id,
          newAccountName: !picked && createNew ? accountQuery.trim() : undefined,
          source: form.source || undefined,
          estValueCents: form.value ? Math.round(parseFloat(form.value) * 100) : undefined,
          notes: form.notes || undefined,
          qualifyNow,
          checks: CHECKS.filter((c) => checks[c]),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; dealId?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        onClose();
        if (qualifyNow && data.dealId) router.push(`/dashboard/sales/deals/${data.dealId}`, { scroll: false });
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "5vh 16px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New contact"
        style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 580, padding: "22px 24px 20px" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>New contact</h2>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>
              one record forever — lead is a state, not a thing
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 16, cursor: "pointer", padding: 2 }}>
            ×
          </button>
        </div>

        {/* Name + email */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div>
            <div className="kicker" style={labelStyle}>Name</div>
            <input ref={nameRef} style={inputStyle} value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <div className="kicker" style={labelStyle}>
              Email <span style={{ textTransform: "none", letterSpacing: 0 }}>— optional now, editable forever</span>
            </div>
            <input style={inputStyle} inputMode="email" value={form.email} onChange={set("email")} />
          </div>
        </div>

        {/* Account combobox */}
        <div style={{ marginTop: 12, position: "relative" }}>
          <div className="kicker" style={labelStyle}>Account</div>
          {picked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9, border: "2px solid var(--cobalt)", borderRadius: 9, padding: "7px 10px" }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: "#F1F2F4", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 9.5, flex: "none" }}>
                {initials(picked.name)}
              </span>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{picked.name}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>existing account · {picked.state}</span>
              <button onClick={() => { setPicked(null); setAccountQuery(""); }} style={{ marginLeft: "auto", border: 0, background: "none", color: "#C4C8CF", fontSize: 14, cursor: "pointer" }} aria-label="Clear account">
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                style={{ ...inputStyle, ...(createNew ? { borderColor: "var(--cobalt)" } : null) }}
                placeholder="Type to find an account…"
                value={accountQuery}
                onFocus={() => setComboOpen(true)}
                onBlur={() => setTimeout(() => setComboOpen(false), 150)}
                onChange={(e) => {
                  setAccountQuery(e.target.value);
                  setComboOpen(true);
                  setCreateNew(false);
                }}
              />
              {createNew && accountQuery.trim() && (
                <div className="mono" style={{ fontSize: 10, color: "var(--cobalt-text)", marginTop: 4 }}>
                  will create “{accountQuery.trim()}” as a new prospect account
                </div>
              )}
              {comboOpen && (matches.length > 0 || accountQuery.trim()) && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 5, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-card)", marginTop: 4, overflow: "hidden" }}>
                  {matches.map((a) => (
                    <button
                      key={a.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPicked(a);
                        setCreateNew(false);
                        setComboOpen(false);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: 0, background: "none", padding: "8px 10px", cursor: "pointer" }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "#F1F2F4", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 9.5, flex: "none" }}>
                        {initials(a.name)}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginLeft: "auto" }}>existing account · {a.state}</span>
                    </button>
                  ))}
                  {accountQuery.trim() && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCreateNew(true);
                        setComboOpen(false);
                      }}
                      style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderTop: matches.length ? "1px solid var(--border-soft)" : 0, background: "none", padding: "9px 10px", cursor: "pointer", color: "var(--cobalt-text)", fontWeight: 700, fontSize: 12.5 }}
                    >
                      + create new — “{accountQuery.trim()}”
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Source + value */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <div className="kicker" style={labelStyle}>Source</div>
            <select style={inputStyle} value={form.source} onChange={set("source")}>
              <option value="">—</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="kicker" style={labelStyle}>
              Est. value <span style={{ textTransform: "none", letterSpacing: 0 }}>— gut call is fine</span>
            </div>
            <input className="mono" style={inputStyle} inputMode="numeric" placeholder="$30,000" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") }))} />
          </div>
        </div>

        {/* What they need */}
        <div style={{ marginTop: 12 }}>
          <div className="kicker" style={labelStyle}>What they need</div>
          <textarea style={{ ...inputStyle, minHeight: 74, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} value={form.notes} onChange={set("notes")} placeholder="The intake note — it travels to the deal." />
        </div>

        {/* Qualification quick-check */}
        <div style={{ background: "#FBFBFC", border: "1px solid #EDEDF1", borderRadius: 11, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="kicker">Already know enough?</span>
            <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, marginLeft: "auto", color: fastLane ? "#15803D" : "var(--muted-line)" }}>
              {checkedN} of 3{fastLane ? " — fast lane open" : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {CHECKS.map((c) => {
              const on = !!checks[c];
              return (
                <button
                  key={c}
                  onClick={() => setChecks((m) => ({ ...m, [c]: !m[c] }))}
                  style={{
                    border: `1px solid ${on ? "#BFE6CC" : "#E2E3E8"}`,
                    background: on ? "#DCF5E3" : "var(--white)",
                    color: on ? "#15803D" : "#767B85",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {on ? "✓ " : ""}
                  {c}
                  {!on && c === "Decision maker" ? "?" : ""}
                </button>
              );
            })}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 9 }}>
            check what you know — 2+ unlocks “Start deal”. unchecked contacts go to Triage for scoring.
          </div>
        </div>

        {error && <p style={{ color: "#b00020", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={() => submit(false)}
            disabled={busy || !form.name.trim()}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flex: "1 1 30%" }}
          >
            {busy ? "Saving…" : "Save to Triage"}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={busy || !canSubmitDeal}
            title={!canStartDeal ? "Admin / account owner only" : !fastLane ? "Check 2+ of the quick-check first" : !hasAccount ? "Pick or create an account first" : undefined}
            style={{
              background: canSubmitDeal ? "var(--ink)" : "#B4B9C1",
              color: "var(--white)",
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: canSubmitDeal && !busy ? "pointer" : "default",
              flex: "2 1 50%",
            }}
          >
            {busy ? "Working…" : "Start deal → Discovery"}
          </button>
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", textAlign: "center", marginTop: 9 }}>
          start deal = contact marked qualified · card opens in Discovery · bypass logged
        </div>
      </div>
    </div>
  );
}
