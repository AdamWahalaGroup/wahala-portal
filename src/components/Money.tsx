import { formatCents } from "@/lib/format";

/** Money in tabular figures. */
export function Money({ cents, style }: { cents: number; style?: React.CSSProperties }) {
  return (
    <span className="tabular" style={style}>
      {formatCents(cents)}
    </span>
  );
}
