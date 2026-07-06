"use client";

/**
 * Stage-advance achievement moments (Jason feedback: "I didn't feel like we just
 * achieved something"). Forward moves get a quiet bottom-center toast naming what
 * just got unlocked; Won gets the full overlay — that's the moment the account
 * flips to an active client. Lost never celebrates (it gets the post-mortem).
 * Pure presentation: setDealStage already did the meaningful work server-side.
 */
import Link from "next/link";
import { useEffect } from "react";

export type StageMoment = {
  stage: string;
  dealId: string | null;
  dealName: string;
  orgName?: string | null;
};

const ORDER: Record<string, number> = { discovery: 1, proposal_out: 2, negotiating: 3, committed: 4, won: 5 };

/** Forward moves only; never for lost. `from` null = arriving fresh (qualify). */
export function stageMomentFor(
  from: string | null | undefined,
  to: string,
  deal: { id: string | null; name: string; organizationName?: string | null },
): StageMoment | null {
  if (!(to in ORDER)) return null;
  if (from && (ORDER[from] ?? 0) >= ORDER[to]) return null;
  return { stage: to, dealId: deal.id, dealName: deal.name, orgName: deal.organizationName ?? null };
}

const TOAST_COPY: Record<string, { headline: string; sub: string }> = {
  discovery: { headline: "Deal started 🚀", sub: "Record the first call — the package fills itself." },
  proposal_out: { headline: "Proposal out →", sub: "The at-risk clock is running — chase a real yes/no." },
  negotiating: { headline: "They're engaged 🤝", sub: "Name the open terms; keep the substatus current." },
  committed: { headline: "Committed 🎉", sub: "Agreement package seeded — deposit next; it gates the project." },
};

const TOAST_MS = 6_000;

function StageToast({ moment, onDismiss }: { moment: StageMoment; onDismiss: () => void }) {
  const copy = TOAST_COPY[moment.stage];
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);
  if (!copy) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--ink)",
        color: "var(--white)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 11,
        zIndex: 90,
        boxShadow: "var(--shadow-modal)",
        maxWidth: "min(92vw, 460px)",
        animation: "toast-in 180ms ease-out",
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#16A34A", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flex: "none", marginTop: 1 }}>
        ✓
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>
          {copy.headline}
          <span style={{ fontWeight: 600, color: "#aeb2bb" }}> — {moment.dealName}</span>
        </div>
        <div style={{ fontSize: 12, color: "#cfd2da", marginTop: 2, lineHeight: 1.45 }}>{copy.sub}</div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ border: 0, background: "none", color: "#8b909a", fontSize: 15, lineHeight: 1, cursor: "pointer", padding: 0, flex: "none", marginTop: 1 }}
      >
        ×
      </button>
    </div>
  );
}

const CONFETTI_COLORS = ["var(--cobalt)", "#16A34A", "#D97706", "var(--ink)"];

function ConfettiBurst() {
  // Deterministic pseudo-random per index — client-only render, run once.
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 28 }, (_, i) => {
        const left = ((i * 37 + 11) % 100 + (i % 3) * 0.7) % 100;
        const delay = (i * 53) % 400;
        const dur = 2000 + ((i * 97) % 800);
        const w = 6 + (i % 3) * 2;
        const h = 8 + ((i + 1) % 3) * 3;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${left}%`,
              width: w,
              height: h,
              borderRadius: 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              opacity: 0,
              animation: `confetti-fall ${dur}ms ease-in ${delay}ms forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

function WonCelebration({ moment, onDismiss, inDrawer = false }: { moment: StageMoment; onDismiss: () => void; inDrawer?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <ConfettiBurst />
      <div
        role="dialog"
        aria-label={`Won — ${moment.dealName}`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", padding: "28px 30px", maxWidth: 440, width: "100%", textAlign: "center", animation: "pop-in 200ms ease-out" }}
      >
        <div style={{ fontSize: 34, lineHeight: 1 }}>🎉</div>
        <h2 style={{ margin: "12px 0 0", fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>Won — {moment.dealName}</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
          {moment.orgName ? <b style={{ color: "var(--ink)" }}>{moment.orgName}</b> : "The account"} is now a client — the account flipped to
          active, and the Discovery Package graduated into their AI memory.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          {!inDrawer && moment.dealId && (
            <Link
              href={`/dashboard/sales/deals/${moment.dealId}`}
              onClick={onDismiss}
              style={{ background: "var(--cobalt)", color: "var(--white)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              Open deal → create the project
            </Link>
          )}
          <button
            onClick={onDismiss}
            style={{ background: inDrawer ? "var(--cobalt)" : "transparent", color: inDrawer ? "var(--white)" : "var(--muted)", border: inDrawer ? 0 : "1px solid #E2E3E8", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {inDrawer ? "Create the project →" : "Back to board"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One layer per surface: toast for forward steps, the full overlay for Won. */
export function StageMomentLayer({ moment, onDismiss, inDrawer = false }: { moment: StageMoment | null; onDismiss: () => void; inDrawer?: boolean }) {
  if (!moment) return null;
  return moment.stage === "won" ? (
    <WonCelebration moment={moment} onDismiss={onDismiss} inDrawer={inDrawer} />
  ) : (
    <StageToast moment={moment} onDismiss={onDismiss} />
  );
}
