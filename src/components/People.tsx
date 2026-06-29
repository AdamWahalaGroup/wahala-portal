/** Circular initials avatar — account owner = ink, lead engineer = cobalt, else surface. */
export function Avatar({
  name,
  size = 32,
  variant = "default",
}: {
  name: string;
  size?: number;
  variant?: "default" | "owner" | "lead";
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const bg = variant === "owner" ? "var(--ink)" : variant === "lead" ? "var(--cobalt)" : "var(--surface)";
  const color = variant === "default" ? "var(--ink-soft)" : "var(--white)";
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        flex: "none",
      }}
    >
      {initials}
    </span>
  );
}

/** Avatar + name + role label. */
export function PeopleCard({
  name,
  role,
  variant = "default",
}: {
  name: string;
  role: string;
  variant?: "default" | "owner" | "lead";
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Avatar name={name} variant={variant} size={34} />
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
        <div className="kicker" style={{ fontSize: 10.5 }}>
          {role}
        </div>
      </div>
    </div>
  );
}
