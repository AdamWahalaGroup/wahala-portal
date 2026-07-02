"use client";

/**
 * Shared right-side drawer shell (frame 29). Lead workspace, deal room, and proposal
 * editor all render inside this same 520px panel over the dimmed board. Only the shell
 * (Esc key, close, slide-in, focus trap) is a client island; the content is passed in
 * as server-rendered children. Closing navigates back to the bare board (/dashboard/sales),
 * so the persistent board layout stays mounted and browser-back closes it too.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SalesDrawer({
  routeEcho,
  footer,
  children,
}: {
  /** Mono breadcrumb-ish echo shown top-center (e.g. "sales / deal / Meridian"). */
  routeEcho?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  const close = () => router.push("/dashboard/sales", { scroll: false });

  useEffect(() => {
    setShown(true); // trigger the slide-in after mount
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        // Lightweight focus trap: keep Tab within the panel.
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      {/* Backdrop dims the board; click closes. */}
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(16,18,24,.28)",
          opacity: shown ? 1 : 0,
          transition: "opacity 160ms ease",
        }}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(520px, 100vw)",
          background: "var(--surface-soft)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-24px 0 60px -24px rgba(0,0,0,.28)",
          display: "flex",
          flexDirection: "column",
          transform: shown ? "translateX(0)" : "translateX(24px)",
          opacity: shown ? 1 : 0,
          transition: "transform 180ms cubic-bezier(.2,.7,.3,1), opacity 160ms ease",
          outline: "none",
        }}
      >
        {/* Top bar: ← Board · route echo · × */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--white)",
            flex: "none",
          }}
        >
          <button
            onClick={close}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              color: "var(--cobalt-text)",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
              flex: "none",
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>←</span> Board
          </button>
          {routeEcho && (
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-line)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
              {routeEcho}
            </span>
          )}
          <button
            onClick={close}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "var(--muted-line)", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0, flex: "none", marginLeft: routeEcho ? 0 : "auto" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px 20px 24px" }}>{children}</div>

        {/* Footer actions */}
        {footer && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--white)", flex: "none", flexWrap: "wrap" }}>
            {footer}
            <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginLeft: "auto" }}>Esc closes · board unchanged behind</span>
          </div>
        )}
      </aside>
    </div>
  );
}
