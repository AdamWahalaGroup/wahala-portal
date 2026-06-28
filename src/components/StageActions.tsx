"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTION_LABELS } from "@/lib/format";

/**
 * Renders one button per action the server says this user may take on this stage,
 * POSTs to /api/stages/:id/:action, and refreshes on success. The server re-checks
 * everything — these buttons are just the affordances.
 */
export function StageActions({ stageId, actions }: { stageId: string; actions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/stages/${stageId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Action failed (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0) {
    return <p style={{ color: "#888", fontSize: 14 }}>No actions available to you in this state.</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => run(a)}
            disabled={busy !== null}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 14,
              cursor: busy ? "default" : "pointer",
              background: a === "reject_quote" || a === "request_revision" ? "#b91c1c" : "#111",
              color: "#fff",
              opacity: busy && busy !== a ? 0.5 : 1,
            }}
          >
            {busy === a ? "Working…" : (ACTION_LABELS[a] ?? a)}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 14, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
