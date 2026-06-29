/** Wahala wordmark + mark (rounded square holding a rotated cobalt diamond). */
export function Brand({ size = 26, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const onInk = tone === "light";
  const square = onInk ? "var(--white)" : "var(--ink)";
  const word = onInk ? "var(--white)" : "var(--ink)";
  const m = size;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <span
        style={{
          width: m,
          height: m,
          borderRadius: Math.round(m * 0.28),
          background: square,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <span
          style={{
            width: Math.round(m * 0.42),
            height: Math.round(m * 0.42),
            background: "var(--cobalt)",
            transform: "rotate(45deg)",
            borderRadius: 2,
          }}
        />
      </span>
      <span style={{ fontWeight: 800, fontSize: Math.round(size * 0.82), letterSpacing: "-.02em", color: word }}>
        wahala
      </span>
    </span>
  );
}
