"use client";

/**
 * Back to wherever you came from — history-aware, so a deal room opened from the
 * Board returns to the Board, one opened from Leads returns to Leads, etc. Falls back
 * to a fixed parent when the page was opened cold (no in-app history to pop).
 */
import { useRouter } from "next/navigation";

export function BackButton({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();

  function go() {
    // >1 means there's a prior entry in this tab's session to return to.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button
      onClick={go}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "5px 11px 5px 9px",
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--ink-soft)",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>←</span>
      {label}
    </button>
  );
}
