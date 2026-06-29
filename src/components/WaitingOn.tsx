import { WAITING_ON } from "@/lib/theme";

/** "Waiting on you" (amber) vs "Waiting on Wahala" (grey) indicator. */
export function WaitingOn({ who }: { who: "you" | "wahala" }) {
  const w = WAITING_ON[who];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: w.bg,
        color: w.text,
        border: `1px solid ${w.border}`,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: w.dot, flex: "none" }} />
      {w.label}
    </span>
  );
}
