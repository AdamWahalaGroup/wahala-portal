const COLORS: Record<string, string> = {
  draft: "#6b7280",
  quoted: "#2563eb",
  approved: "#7c3aed",
  paid: "#0891b2",
  in_progress: "#d97706",
  delivered: "#0d9488",
  accepted: "#16a34a",
  needs_revision: "#dc2626",
  rejected: "#b91c1c",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        background: COLORS[status] ?? "#6b7280",
        color: "#fff",
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
