/**
 * The deal room's sales-stage spine (frame 24): Discovery → … → Contract → Won.
 * Completed (visited) = ink ✓ · current = status-colored ring · a stage the deal
 * skipped past renders dashed/muted with "skipped" — dispositions, never enforced.
 */
import { FUNNEL_STAGES, STAGE_META, type DealStage } from "@/domain/sales";
import { STAGE_COLORS } from "@/components/SalesChips";

const SPINE: DealStage[] = [...FUNNEL_STAGES, "won"];

export function SalesStepper({ current, visited }: { current: DealStage; visited: DealStage[] }) {
  const lost = current === "lost";
  const currentIdx = lost ? -1 : SPINE.indexOf(current);
  const visitedSet = new Set(visited);

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {SPINE.map((stage, i) => {
        const isCurrent = stage === current;
        const isPast = currentIdx >= 0 && i < currentIdx;
        const wasVisited = visitedSet.has(stage);
        const skipped = isPast && !wasVisited;
        const color = STAGE_COLORS[stage];

        let node: React.ReactNode;
        if (isCurrent) {
          node = (
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--white)",
                border: `3px solid ${color}`,
                boxShadow: `0 0 0 4px ${color}22`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} />
            </span>
          );
        } else if (isPast && wasVisited) {
          node = (
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--ink)", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, flex: "none" }}>
              ✓
            </span>
          );
        } else if (skipped) {
          node = (
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--white)", border: "2px dashed var(--muted-line)", display: "inline-flex", flex: "none" }} />
          );
        } else {
          node = (
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "inline-flex", flex: "none" }} />
          );
        }

        return (
          <div key={stage} style={{ display: "flex", alignItems: "flex-start", flex: i === SPINE.length - 1 ? "none" : 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 78, flex: "none" }}>
              {node}
              <span
                className="kicker"
                style={{
                  fontSize: 8.5,
                  textAlign: "center",
                  lineHeight: 1.3,
                  color: isCurrent ? color : skipped ? "var(--muted-line)" : isPast ? "var(--ink-soft)" : "var(--muted-line)",
                  fontWeight: isCurrent ? 800 : 600,
                }}
              >
                {STAGE_META[stage].label}
                {skipped ? <><br />(skipped)</> : null}
              </span>
            </div>
            {i < SPINE.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 12,
                  background: isPast || isCurrent ? "var(--ink)" : "var(--border)",
                  opacity: skipped ? 0.35 : 1,
                  minWidth: 8,
                }}
              />
            )}
          </div>
        );
      })}
      {lost && (
        <span className="kicker" style={{ marginLeft: 12, fontSize: 10, padding: "4px 10px", borderRadius: 999, background: "#FBE3E3", color: "#B91C1C", flex: "none" }}>
          Lost
        </span>
      )}
    </div>
  );
}
