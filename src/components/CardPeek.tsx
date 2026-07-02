"use client";

/**
 * Board card peek (frame 21c) — click a card and its detail opens in place, so the
 * scout report is readable without switching to the Leads tab or the deal room.
 * A light popover anchored beside the clicked card (clamped to the viewport), with a
 * click-away backdrop and Esc to close.
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { ScoreChip, DaysTag, STAGE_COLORS } from "@/components/SalesChips";
import type { DealItem, LeadItem } from "@/services/sales";
import { STAGE_META } from "@/domain/sales";

export type PeekTarget = { kind: "lead"; lead: LeadItem } | { kind: "deal"; deal: DealItem };
export type PeekAnchor = { top: number; left: number; width: number; height: number };

const PANEL_W = 348;

function ScoutWell({ md }: { md: string | null }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="kicker" style={{ marginBottom: 6 }}>Scout report</div>
      {md ? (
        <div
          className="mono"
          style={{ background: "#FBFBFC", border: "1px solid #EDEDF1", borderRadius: 10, padding: "10px 12px", maxHeight: 260, overflowY: "auto" }}
        >
          <SimpleMarkdown md={md} size={12} />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted-line)" }}>
          ◆ Not analyzed yet — run the scout from the lead workspace.
        </p>
      )}
    </div>
  );
}

export function CardPeek({
  target,
  anchor,
  busy,
  onClose,
  onQualify,
  onPass,
}: {
  target: PeekTarget;
  anchor: PeekAnchor | null;
  busy: boolean;
  onClose: () => void;
  onQualify: (leadId: string) => void;
  onPass: (lead: LeadItem) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 80, left: 80 });

  // Anchor beside the card, then clamp into the viewport.
  useLayoutEffect(() => {
    const h = panelRef.current?.offsetHeight ?? 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor ? anchor.left + anchor.width + 10 : vw / 2 - PANEL_W / 2;
    if (left + PANEL_W > vw - 12) left = anchor ? Math.max(12, anchor.left - PANEL_W - 10) : vw / 2 - PANEL_W / 2;
    left = Math.max(12, Math.min(left, vw - PANEL_W - 12));
    let top = anchor ? anchor.top : vh / 2 - h / 2;
    top = Math.max(12, Math.min(top, vh - h - 12));
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const header = (title: string, right: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.015em", lineHeight: 1.25 }}>{title}</div>
      </div>
      {right}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ border: 0, background: "none", color: "var(--muted-line)", fontSize: 18, lineHeight: 1, cursor: "pointer", flex: "none", padding: 0 }}
      >
        ×
      </button>
    </div>
  );

  const btn = (label: string, kind: "ink" | "secondary" | "danger", onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        border: kind === "ink" ? "none" : "1px solid #d7d9df",
        background: kind === "ink" ? "var(--ink)" : "var(--white)",
        color: kind === "danger" ? "#b91c1c" : kind === "ink" ? "var(--white)" : "var(--ink-soft)",
        borderColor: kind === "danger" ? "#f0caca" : undefined,
        borderRadius: 8,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(16,18,24,.18)", zIndex: 40 }} />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: PANEL_W,
          maxHeight: "calc(100vh - 24px)",
          overflowY: "auto",
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 24px 60px -24px rgba(0,0,0,.35)",
          padding: 16,
          zIndex: 41,
        }}
      >
        {target.kind === "lead"
          ? (() => {
              const l = target.lead;
              const meta = [l.company, l.industry, l.source && `via ${l.source}`].filter(Boolean).join(" · ");
              return (
                <>
                  {header(l.name, <ScoreChip score={l.aiScore} verdict={l.aiVerdict} />)}
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    lead · {meta || "no details yet"} · {new Date(l.createdAt).toLocaleDateString()}
                    {l.overdue ? " · ⚠ overdue for triage" : ""}
                  </div>
                  <ScoutWell md={l.aiAnalysisMd} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {btn("Qualify → Discovery", "ink", () => onQualify(l.id))}
                    {btn("Pass", "danger", () => onPass(l))}
                    <Link
                      href={`/dashboard/sales/leads/${l.id}`}
                      style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}
                    >
                      Open lead workspace →
                    </Link>
                  </div>
                </>
              );
            })()
          : (() => {
              const d = target.deal;
              return (
                <>
                  {header(
                    d.name,
                    <span
                      className="kicker"
                      style={{ fontSize: 9.5, padding: "3px 8px", borderRadius: 6, background: "var(--surface)", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: STAGE_COLORS[d.stage] }} />
                      {STAGE_META[d.stage].label}
                    </span>,
                  )}
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {d.organizationName}
                    {d.ownerName ? ` · ${d.ownerName}` : ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    {d.valueCents > 0 && <Money cents={d.valueCents} style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em" }} />}
                    <DaysTag days={d.daysInStage} stuck={d.stuck} />
                  </div>
                  <div style={{ marginTop: 12, background: "var(--surface-soft)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px" }}>
                    <div className="kicker" style={{ marginBottom: 3 }}>Next step</div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>{d.nextStep}</p>
                  </div>
                  {(d.scoutMd || d.scoutScore !== null) && (
                    <div style={{ marginTop: 12 }}>
                      {d.scoutScore !== null && (
                        <div style={{ marginBottom: 2 }}>
                          <ScoreChip score={d.scoutScore} verdict={d.scoutVerdict} />
                        </div>
                      )}
                      <ScoutWell md={d.scoutMd} />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
                    <Link
                      href={`/dashboard/sales/deals/${d.id}`}
                      style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}
                    >
                      Open deal room →
                    </Link>
                  </div>
                </>
              );
            })()}
      </div>
    </>
  );
}
