import { VISIBILITY } from "@/lib/theme";

/** Client-visible (cobalt wash) vs internal-only (ink, ⊘) marker. */
export function VisibilityMarker({ visibility }: { visibility: "client_visible" | "internal" }) {
  const v = VISIBILITY[visibility];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        background: v.bg,
        color: v.text,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {visibility === "internal" ? "⊘ " : ""}
      {v.label}
    </span>
  );
}
