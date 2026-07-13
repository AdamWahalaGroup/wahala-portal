"use client";

/**
 * Deal editing widgets for the deal detail page: stage disposition select and a
 * small name / value / notes form. Fetch → router.refresh(), same as StageActions.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FieldHelp } from "@/components/FieldHelp";
import {
  DATA_SENSITIVITIES,
  DATA_SENSITIVITY_DESCRIPTIONS,
  DATA_SENSITIVITY_LABELS,
  DELIVERY_MODELS,
  DELIVERY_MODEL_LABELS,
  ENGAGEMENT_TYPES,
  ENGAGEMENT_TYPE_LABELS,
  IP_DISPOSITIONS,
  IP_DISPOSITION_LABELS,
  type DataSensitivity,
  type DeliveryModel,
  type EngagementType,
  type IpDisposition,
} from "@/domain/deal-operating-model";

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "proposal_out", label: "Proposal out" },
  { value: "negotiating", label: "Negotiating" },
  { value: "committed", label: "Contracting" },
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

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

function dateOnly(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function FieldLabel({ children, help }: { children: React.ReactNode; help?: React.ReactNode }) {
  const label = typeof children === "string" ? children : "this field";
  return (
    <div className="kicker" style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
      <span>{children}</span>
      {help && <FieldHelp label={label}>{help}</FieldHelp>}
    </div>
  );
}

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
        Stages are dispositions — move it wherever the deal actually is. Every move is logged.
        Phases belong to projects; Stages belong to deals.
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
  engagementType,
  deliveryModel,
  ipDisposition,
  dataSensitivity,
  supportExpectation,
  expectedCloseAt,
}: {
  dealId: string;
  name: string;
  valueCents: number;
  notes: string | null;
  engagementType: EngagementType | null;
  deliveryModel: DeliveryModel | null;
  ipDisposition: IpDisposition;
  dataSensitivity: DataSensitivity;
  supportExpectation: string | null;
  expectedCloseAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name,
    value: valueCents > 0 ? String(valueCents / 100) : "",
    notes: notes ?? "",
    engagementType: engagementType ?? "",
    deliveryModel: deliveryModel ?? "",
    ipDisposition,
    dataSensitivity,
    supportExpectation: supportExpectation ?? "",
    expectedCloseAt: dateOnly(expectedCloseAt),
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
      engagementType: form.engagementType || null,
      deliveryModel: form.deliveryModel || null,
      ipDisposition: form.ipDisposition,
      dataSensitivity: form.dataSensitivity,
      supportExpectation: form.supportExpectation,
      expectedCloseAt: form.expectedCloseAt || null,
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
      <section style={sectionStyle}>
        <div className="kicker" style={{ color: "var(--cobalt-text)" }}>Commercial shape</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel>Deal name</FieldLabel>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <FieldLabel help="A rough portfolio-planning estimate, not a quote, forecast, or promise. Record the evidence behind it in the qualification section.">Estimated value ($)</FieldLabel>
            <input style={inputStyle} inputMode="numeric" placeholder="Gut range anchor, not a quote" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") }))} />
          </div>
          <div>
            <FieldLabel help="The buyer-supported target date for a decision or signed agreement. Leave it blank when it is only a founder hope.">Expected close</FieldLabel>
            <input type="date" style={inputStyle} value={form.expectedCloseAt} onChange={(e) => setForm((f) => ({ ...f, expectedCloseAt: e.target.value }))} />
          </div>
          <div>
            <FieldLabel help="What Wahala is selling: a product/license, modernization, custom build, paid discovery, advisory work, or support.">Engagement type</FieldLabel>
            <select style={inputStyle} value={form.engagementType} onChange={(e) => setForm((f) => ({ ...f, engagementType: e.target.value as EngagementType | "" }))}>
              <option value="">Unclassified</option>
              {ENGAGEMENT_TYPES.map((value) => <option key={value} value={value}>{ENGAGEMENT_TYPE_LABELS[value]}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel help="How the engagement will be structured and delivered. This is separate from what is being sold and from the payment schedule.">Delivery model</FieldLabel>
            <select style={inputStyle} value={form.deliveryModel} onChange={(e) => setForm((f) => ({ ...f, deliveryModel: e.target.value as DeliveryModel | "" }))}>
              <option value="">Unclassified</option>
              {DELIVERY_MODELS.map((value) => <option key={value} value={value}>{DELIVERY_MODEL_LABELS[value]}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel help="The intended ownership or license outcome for code and deliverables. It records the commercial position; it does not prove Wahala has authority to sell or transfer the IP.">IP disposition</FieldLabel>
            <select style={inputStyle} value={form.ipDisposition} onChange={(e) => setForm((f) => ({ ...f, ipDisposition: e.target.value as IpDisposition }))}>
              {IP_DISPOSITIONS.map((value) => <option key={value} value={value}>{IP_DISPOSITION_LABELS[value]}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel
              help={
                <span className="field-help__definitions">
                  <span>Classify the most sensitive data the work may receive, store, transmit, or send to a provider. When unsure, choose the higher risk until discovery proves otherwise.</span>
                  {DATA_SENSITIVITIES.map((value) => (
                    <span key={value}><b>{DATA_SENSITIVITY_LABELS[value]}:</b> {DATA_SENSITIVITY_DESCRIPTIONS[value]}</span>
                  ))}
                </span>
              }
            >Data sensitivity</FieldLabel>
            <select style={inputStyle} value={form.dataSensitivity} onChange={(e) => setForm((f) => ({ ...f, dataSensitivity: e.target.value as DataSensitivity }))}>
              {DATA_SENSITIVITIES.map((value) => <option key={value} value={value}>{DATA_SENSITIVITY_LABELS[value]}</option>)}
            </select>
            <p style={{ margin: "6px 2px 0", fontSize: 11.5, lineHeight: 1.45, color: "var(--muted)" }}>
              {DATA_SENSITIVITY_DESCRIPTIONS[form.dataSensitivity]}
            </p>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldLabel help="What Wahala must do after handoff or acceptance: warranty fixes, enablement, monitoring, response times, a paid retainer, or explicitly nothing.">Support expectation</FieldLabel>
            <input style={inputStyle} placeholder="Warranty, enablement, retainer, or explicitly none" value={form.supportExpectation} onChange={(e) => setForm((f) => ({ ...f, supportExpectation: e.target.value }))} />
          </div>
        </div>
      </section>

      <div>
        <FieldLabel>Notes</FieldLabel>
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
