"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

/** Viewport-positioned help so tooltips are not clipped by drawers or cards. */
export function FieldHelp({ children, label }: { children: React.ReactNode; label: string }) {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 320, placeBelow: false });

  function show(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(380, window.innerWidth - gutter * 2);
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(gutter, Math.min(centered, window.innerWidth - width - gutter));
    const placeBelow = rect.top < 140;
    setPosition({
      left,
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      width,
      placeBelow,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <span className="field-help" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="field-help__trigger"
        aria-label={`Explain ${label}`}
        aria-describedby={open ? descriptionId : undefined}
        onMouseEnter={(event) => show(event.currentTarget)}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span
          id={descriptionId}
          className="field-help__content"
          role="tooltip"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            transform: position.placeBelow ? "none" : "translateY(-100%)",
          }}
        >
          {children}
        </span>,
        document.body,
      )}
    </span>
  );
}
