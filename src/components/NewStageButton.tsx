"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Creates an empty draft stage, then opens the quote builder (frame 06). */
export function NewStageButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, name: "Untitled stage", totalAmountCents: 0 }),
      });
      const data = (await res.json().catch(() => ({}))) as { stage?: { id: string }; message?: string };
      if (!res.ok || !data.stage) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      router.push(`/dashboard/stages/${data.stage.id}/quote`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {error && <span style={{ color: "#b00020", fontSize: 12.5 }}>{error}</span>}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        style={{
          border: "none",
          borderRadius: 9,
          padding: "8px 14px",
          fontSize: 13.5,
          fontWeight: 600,
          background: "var(--ink)",
          color: "var(--white)",
          cursor: busy ? "default" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "Creating…" : "+ New stage"}
      </button>
    </div>
  );
}
