"use client";

/**
 * "◆ Generate tasks" (R5) — AI breaks the phase's deliverables into internal tasks
 * for the delivery team. Shown to admins / the project lead next to the task list.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GenerateTasksButton({ stageId }: { stageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/stages/${stageId}/generate-tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; created?: number; usage?: { costCents: number } };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else {
        setStatus(`${data.created} internal tasks created${data.usage ? ` · ≈ $${(data.usage.costCents / 100).toFixed(2)}` : ""}`);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button
        onClick={generate}
        disabled={busy}
        style={{
          background: "var(--ink)",
          color: "var(--white)",
          border: "none",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "default" : "pointer",
        }}
        title="AI breaks this phase's deliverables into internal tasks + subtasks for the delivery team"
      >
        {busy ? "Breaking down (~20s)…" : "◆ Generate tasks"}
      </button>
      {status && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>{status}</span>}
      {error && <span style={{ fontSize: 12, color: "#b00020" }}>{error}</span>}
    </span>
  );
}
