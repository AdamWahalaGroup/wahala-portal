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
      const res = await fetch("/api/phases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, name: "Untitled phase", totalAmountCents: 0 }),
      });
      const data = (await res.json().catch(() => ({}))) as { stage?: { id: string }; message?: string };
      if (!res.ok || !data.stage) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      router.push(`/dashboard/phases/${data.stage.id}/quote`);
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={create}
        disabled={busy}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 11,
          padding: "13px 16px",
          fontSize: 14.5,
          fontWeight: 700,
          background: "var(--ink)",
          color: "var(--white)",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Creating…" : "+ New phase — scope the next one"}
      </button>
      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
