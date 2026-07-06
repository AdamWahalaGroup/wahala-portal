"use client";

/**
 * Deal editing widgets for the deal detail page: stage disposition select and a
 * small name / value / notes form. Fetch → router.refresh(), same as StageActions.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "proposal_out", label: "Proposal out" },
  { value: "negotiating", label: "Negotiating" },
  { value: "committed", label: "Committed" },
  { value: "won", label: "Won 🎉" },
  { value: "lost", label: "Lost" },
];

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

async function patchDeal(dealId: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      return data.message ?? `Request failed (${res.status}).`;
    }
    return null;
  } catch {
    return "Network error — please try again.";
  }
}

export function DealStageSelect({ dealId, stage, onMoved }: { dealId: string; stage: string; onMoved?: (to: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(next: string) {
    setBusy(true);
    setError(null);
    const err = await patchDeal(dealId, { stage: next });
    if (err) setError(err);
    else {
      onMoved?.(next);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div>
      <select value={stage} disabled={busy} onChange={(e) => move(e.target.value)} style={{ ...inputStyle, fontWeight: 600 }}>
        {STAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Pipeline steps are dispositions — move it wherever the deal actually is. Every move is logged.
        Only projects have Stages.
      </p>
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}

export function DealFieldsForm({
  dealId,
  name,
  valueCents,
  notes,
}: {
  dealId: string;
  name: string;
  valueCents: number;
  notes: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name,
    value: valueCents > 0 ? String(valueCents / 100) : "",
    notes: notes ?? "",
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const err = await patchDeal(dealId, {
      name: form.name,
      valueCents: form.value ? Math.round(parseFloat(form.value) * 100) : 0,
      notes: form.notes,
    });
    if (err) setError(err);
    else {
      setSaved(true);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="kicker" style={{ marginBottom: 5 }}>Deal name</div>
        <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
      </div>
      <div>
        <div className="kicker" style={{ marginBottom: 5 }}>Estimated value ($)</div>
        <input
          style={inputStyle}
          inputMode="numeric"
          placeholder="Gut number, not a quote"
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") }))}
        />
      </div>
      <div>
        <div className="kicker" style={{ marginBottom: 5 }}>Notes</div>
        <textarea
          style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          placeholder="What we know, what they said, what's next…"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
        {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
      </div>
    </form>
  );
}
