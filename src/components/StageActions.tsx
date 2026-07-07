"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTION_LABELS } from "@/lib/format";

/** Actions that get a confirm dialog (weighty / logged / money). */
const CONFIRM: Record<string, { title: string; body: string; confirmLabel: string; tone: "ink" | "green" | "red" }> = {
  accept: {
    title: "Accept this delivery?",
    body: "This is recorded as accepted by you and unlocks the next phase. It can't be undone.",
    confirmLabel: "Yes, accept",
    tone: "green",
  },
  reject_quote: {
    title: "Reject this quote?",
    body: "The phase returns to draft so it can be re-scoped and re-quoted.",
    confirmLabel: "Reject quote",
    tone: "red",
  },
  request_revision: {
    title: "Request a revision?",
    body: "Sends the delivery back for changes. Work resumes once it's revised.",
    confirmLabel: "Request revision",
    tone: "red",
  },
  mark_paid: {
    title: "Mark this phase as paid?",
    body: "Records that payment landed for this phase (normally handled by Stripe). Use this if the money came in outside the system.",
    confirmLabel: "Mark paid",
    tone: "ink",
  },
};

type Tone = "ink" | "green" | "red" | "secondary";

function buttonStyle(tone: Tone, busy: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 9,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    border: "1px solid transparent",
  };
  switch (tone) {
    case "ink":
      return { ...base, background: "var(--ink)", color: "var(--white)" };
    case "green":
      return { ...base, background: "#16a34a", color: "var(--white)" };
    case "red":
      return { ...base, background: "var(--white)", color: "#b91c1c", borderColor: "#f0caca" };
    default:
      return { ...base, background: "var(--white)", color: "var(--ink)", borderColor: "#d7d9df" };
  }
}

function toneFor(action: string, index: number): Tone {
  if (action === "accept") return "green";
  if (action === "reject_quote" || action === "request_revision") return "red";
  return index === 0 ? "ink" : "secondary";
}

export function StageActions({ stageId, actions }: { stageId: string; actions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setError(null);
    setConfirm(null);
    try {
      const res = await fetch(`/api/phases/${stageId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Action failed (${res.status}).`);
        if (res.status === 409) router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  function onClick(action: string) {
    if (CONFIRM[action]) setConfirm(action);
    else run(action);
  }

  if (actions.length === 0) {
    return (
      <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
        No actions available to you in this state.
      </p>
    );
  }

  const dialog = confirm ? CONFIRM[confirm] : null;

  return (
    <div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        {actions.map((a, i) => (
          <button
            key={a}
            onClick={() => onClick(a)}
            disabled={busy !== null}
            style={{ ...buttonStyle(toneFor(a, i), busy !== null), opacity: busy && busy !== a ? 0.5 : 1 }}
          >
            {busy === a ? "Working…" : (ACTION_LABELS[a] ?? a)}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 13.5, marginTop: 10, marginBottom: 0 }}>{error}</p>}

      {dialog && confirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16,18,21,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
          onClick={() => setConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--white)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>
              {dialog.title}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>{dialog.body}</p>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setConfirm(null)} style={buttonStyle("secondary", false)}>
                Cancel
              </button>
              <button onClick={() => run(confirm)} style={buttonStyle(dialog.tone, false)}>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
