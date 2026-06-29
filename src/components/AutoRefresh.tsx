"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetch the current route's server data on an interval so the page reflects
 * changes made elsewhere (e.g. a client accepting an invite in another browser).
 * Pauses while the tab is hidden, and only runs when `enabled`. router.refresh()
 * re-renders the server component without losing client state or scroll.
 */
export function AutoRefresh({ intervalMs = 8000, enabled = true }: { intervalMs?: number; enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
