import { STEPPER_ORDER, STATUS_STYLES } from "@/lib/theme";
import type { StageStatus } from "@/domain/stage-machine";

/** Active-node label shortened to the client's next action, to echo the "On you" CTA. */
const NEXT_ACTION: Partial<Record<StageStatus, string>> = { paid: "Pay", accepted: "Accept" };

/** Lifecycle stepper. Branch states (rejected / needs_revision) anchor to a step + a banner. */
export function Stepper({ status }: { status: StageStatus }) {
  const order = STEPPER_ORDER;
  const n = order.length;
  let currentIndex = order.indexOf(status);
  let branch: StageStatus | null = null;
  if (currentIndex === -1) {
    branch = status;
    currentIndex = status === "rejected" ? order.indexOf("quoted") : order.indexOf("in_progress");
  }
  const current = STATUS_STYLES[branch ?? order[currentIndex]];
  const frac = n > 1 ? currentIndex / (n - 1) : 0;

  return (
    <div style={{ position: "relative", paddingTop: 2 }}>
      <div style={{ position: "absolute", top: 14, height: 2, left: `calc(50% / ${n})`, right: `calc(50% / ${n})`, background: "var(--border)" }} />
      <div style={{ position: "absolute", top: 14, height: 2, left: `calc(50% / ${n})`, width: `calc((100% - 100% / ${n}) * ${frac})`, background: "var(--ink)" }} />
      <div style={{ display: "flex", position: "relative" }}>
        {order.map((st, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "future";
          return (
            <div key={st} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  ...(state === "done"
                    ? { background: "var(--ink)", color: "var(--white)" }
                    : state === "current"
                      ? { background: "var(--white)", border: `2px solid ${current.dot}`, boxShadow: `0 0 0 4px ${current.bg}`, color: current.dot }
                      : { background: "var(--white)", border: "1px solid #d7d9df", color: "var(--muted-line)" }),
                }}
              >
                {state === "done" ? (
                  "✓"
                ) : state === "current" ? (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: current.dot }} />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className="kicker"
                style={{ fontSize: 9.5, color: state === "future" ? "var(--muted-line)" : "var(--ink-soft)", textAlign: "center" }}
              >
                {STATUS_STYLES[st].label}
              </span>
            </div>
          );
        })}
      </div>
      {branch && (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: current.text, background: current.bg, padding: "4px 11px", borderRadius: 999 }}>
            {current.label}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact lifecycle stepper for the client dashboard's project cards. Unlike the full
 * Stepper (where the current status is the highlighted node), this shows the current
 * status as DONE and highlights the NEXT step — the client's pending action — labeling
 * it with the short CTA ("Pay" / "Accept") so it echoes the "On you" section.
 */
export function ProjectStepper({ status }: { status: StageStatus }) {
  const order = STEPPER_ORDER;
  const n = order.length;
  const idx = order.indexOf(status);

  let doneThrough: number; // inclusive index of the last completed node
  let activeIndex: number; // highlighted node, or -1 when terminal
  let branchLabel: string | null = null;
  if (idx === -1) {
    // Branch states (needs_revision / rejected) anchor onto the lifecycle.
    const anchor = status === "rejected" ? order.indexOf("quoted") : order.indexOf("in_progress");
    doneThrough = anchor - 1;
    activeIndex = anchor;
    branchLabel = STATUS_STYLES[status].label;
  } else {
    doneThrough = idx;
    activeIndex = idx + 1 < n ? idx + 1 : -1; // accepted → all done, nothing active
  }

  const activeStyle = branchLabel ? STATUS_STYLES[status] : activeIndex >= 0 ? STATUS_STYLES[order[activeIndex]] : null;
  const fillTo = activeIndex >= 0 ? activeIndex : n - 1;
  const frac = n > 1 ? fillTo / (n - 1) : 0;

  return (
    <div style={{ position: "relative", paddingTop: 1 }}>
      <div style={{ position: "absolute", top: 11, height: 2, left: `calc(50% / ${n})`, right: `calc(50% / ${n})`, background: "var(--border)" }} />
      <div style={{ position: "absolute", top: 11, height: 2, left: `calc(50% / ${n})`, width: `calc((100% - 100% / ${n}) * ${frac})`, background: "var(--ink)" }} />
      <div style={{ display: "flex", position: "relative" }}>
        {order.map((st, i) => {
          const state = i <= doneThrough ? "done" : i === activeIndex ? "current" : "future";
          const label =
            i === activeIndex ? branchLabel ?? NEXT_ACTION[st] ?? STATUS_STYLES[st].label : STATUS_STYLES[st].label;
          return (
            <div key={st} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  ...(state === "done"
                    ? { background: "var(--ink)", color: "var(--white)" }
                    : state === "current" && activeStyle
                      ? { background: "var(--white)", border: `2px solid ${activeStyle.dot}`, boxShadow: `0 0 0 3px ${activeStyle.bg}`, color: activeStyle.dot }
                      : { background: "var(--white)", border: "1px solid #d7d9df", color: "var(--muted-line)" }),
                }}
              >
                {state === "done" ? "✓" : state === "current" && activeStyle ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: activeStyle.dot }} /> : i + 1}
              </span>
              <span
                className="kicker"
                style={{
                  fontSize: 9,
                  color: state === "future" ? "var(--muted-line)" : "var(--ink-soft)",
                  fontWeight: state === "current" ? 800 : undefined,
                  textAlign: "center",
                  lineHeight: 1.15,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
