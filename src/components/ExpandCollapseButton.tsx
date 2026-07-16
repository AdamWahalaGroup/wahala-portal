"use client";

type ExpandCollapseButtonProps = {
  expanded: boolean;
  onClick: () => void;
  label?: string;
  size?: number;
};

/** A fixed-size, CSS-drawn disclosure control. Avoid text triangles: their glyph metrics differ by direction. */
export function ExpandCollapseButton({ expanded, onClick, label, size = 30 }: ExpandCollapseButtonProps) {
  const action = expanded ? "Collapse" : "Expand";
  const accessibleLabel = label ? `${action} ${label}` : `${action} section`;
  const chevronSize = Math.max(6, Math.round(size * 0.23));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      style={{
        width: size,
        height: size,
        padding: 0,
        border: "1px solid var(--border)",
        borderRadius: Math.max(6, Math.round(size * 0.27)),
        background: "var(--white)",
        color: "var(--cobalt)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: `0 0 ${size}px`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: chevronSize,
          height: chevronSize,
          borderRight: "1.5px solid currentColor",
          borderBottom: "1.5px solid currentColor",
          transform: `rotate(${expanded ? "225deg" : "45deg"})`,
          marginTop: expanded ? Math.round(size * 0.13) : -Math.round(size * 0.1),
        }}
      />
    </button>
  );
}
