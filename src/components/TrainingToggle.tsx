"use client";

/**
 * Training mode sidebar card (frame 38) — cobalt-dashed, above the user chip.
 * Honest caption: it guides AND it's measured. Self-toggleable; the scorecard
 * lets owners set it for others.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function TrainingCard({ on }: { on: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/settings/training", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ on: !on }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1.5px dashed #4353d8", borderRadius: 12, padding: "10px 12px", background: "rgba(43,62,230,.10)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#aab4f8", flex: 1 }}>Training mode</span>
        <button
          onClick={toggle}
          disabled={busy}
          role="switch"
          aria-checked={on}
          title={on ? "Turn training mode off" : "Turn training mode on"}
          style={{
            width: 32,
            height: 18,
            borderRadius: 999,
            border: 0,
            background: on ? "var(--cobalt)" : "#2c2f36",
            position: "relative",
            cursor: "pointer",
            flex: "none",
            padding: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: on ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "var(--white)",
              transition: "left 120ms ease",
            }}
          />
        </button>
      </div>
      <div className="mono" style={{ fontSize: 9, color: "#8b93c9", marginTop: 4 }}>
        guides the process · logs to your scorecard
      </div>
    </div>
  );
}
