"use client";

/**
 * The public approve control on the share-link proposal page: pick Option A or B,
 * type your name, one click. No login — the unguessable URL is the credential.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PublicApprove({
  token,
  options,
}: {
  token: string;
  options: { id: string; label: string; name: string }[];
}) {
  const router = useRouter();
  const [optionId, setOptionId] = useState<string>("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/p/${token}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId, name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Something went wrong (${res.status}). Please contact your Wahala representative.`);
      } else {
        setDone(true);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ background: "#e8f7ee", border: "1px solid #bfe8cf", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#15803d" }}>Approved — thank you!</div>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>
          Your Wahala representative will be in touch to start the contract paperwork. Nothing is owed today.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
      <div className="kicker" style={{ marginBottom: 12 }}>Ready to move forward?</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setOptionId(o.id)}
            style={{
              flex: "1 1 180px",
              textAlign: "left",
              background: optionId === o.id ? "var(--ink)" : "var(--surface-soft)",
              color: optionId === o.id ? "var(--white)" : "var(--ink)",
              border: "1px solid " + (optionId === o.id ? "var(--ink)" : "#d7d9df"),
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <div className="kicker" style={{ fontSize: 9.5, color: optionId === o.id ? "#aeb2bb" : "var(--muted)" }}>
              Option {o.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{o.name}</div>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your full name to approve"
          style={{ flex: "1 1 220px", border: "1px solid #d7d9df", borderRadius: 9, padding: "10px 12px", fontSize: 14 }}
        />
        <button
          onClick={approve}
          disabled={busy || !optionId || name.trim().length < 2}
          style={{
            background: "#16a34a",
            color: "var(--white)",
            border: "none",
            borderRadius: 9,
            padding: "11px 20px",
            fontSize: 14.5,
            fontWeight: 700,
            cursor: "pointer",
            opacity: !optionId || name.trim().length < 2 ? 0.5 : 1,
          }}
        >
          {busy ? "Recording…" : "Approve this proposal"}
        </button>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--muted)" }}>
        Approving signals you&apos;d like to proceed to contracting. It is not a payment and there is no deposit.
      </p>
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
