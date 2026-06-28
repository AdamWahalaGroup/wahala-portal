"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 8,
  boxSizing: "border-box",
};

/** Create a draft stage on a project (staff/owner). POSTs to /api/stages. */
export function CreateStageForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const dollars = parseFloat(amount);
    const lineItems = items
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((description) => ({ description }));
    try {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          totalAmountCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
          lineItems,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setName("");
        setAmount("");
        setItems("");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      <input style={input} placeholder="Stage name (e.g. Discovery)" value={name} onChange={(e) => setName(e.target.value)} required />
      <input style={input} placeholder="Amount in USD (e.g. 2500)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      <textarea
        style={{ ...input, minHeight: 72, fontFamily: "inherit" }}
        placeholder="Line items — one per line"
        value={items}
        onChange={(e) => setItems(e.target.value)}
      />
      <div>
        <button
          type="submit"
          disabled={busy}
          style={{ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, background: "#111", color: "#fff", cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "Creating…" : "Create stage"}
        </button>
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 14, margin: 0 }}>{error}</p>}
    </form>
  );
}
