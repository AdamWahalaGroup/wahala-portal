import { STATUS_STYLES } from "@/lib/theme";
import type { StageStatus } from "@/domain/stage-machine";

/** Status pill — soft tint bg + dark text + solid dot (status by text AND dot, WCAG AA). */
export function StatusBadge({ status }: { status: StageStatus | string }) {
  const s = STATUS_STYLES[status as StageStatus] ?? STATUS_STYLES.draft;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 11px 4px 9px",
        borderRadius: 999,
        background: s.bg,
        color: s.text,
        fontWeight: 600,
        fontSize: 12.5,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, flex: "none" }} />
      {s.label}
    </span>
  );
}
