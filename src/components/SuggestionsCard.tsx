"use client";

/**
 * The suggestion box (docs/AGENT-LAYER-DESIGN.md) — the deal pulse's concrete
 * next actions. Humans mark done or ✕ dismiss; agents never act outward
 * themselves. Done items stay visible (struck through) and toggle back to open
 * so a mis-click — or an admin overruling a "done" — is recoverable.
 * Renders nothing when the box is empty (silence beats noise).
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

export type SuggestionItem = { id: string; title: string; bodyMd: string | null; status: "open" | "done"; createdAt: string };

export function SuggestionsCard({ suggestions, canManage }: { suggestions: SuggestionItem[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (suggestions.length === 0) return null;

  async function resolve(id: string, status: "done" | "dismissed" | "open") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section style={{ background: "#FAFBFF", border: "1.5px dashed #C9D0FB", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="kicker" style={{ color: "#2536C4" }}>◆ Suggestion box</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
          from the deal pulse — do it or dismiss it; nothing sends without you
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {suggestions.map((s) => {
          const done = s.status === "done";
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--white)", border: "1px solid #DDE1FB", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ flex: 1, minWidth: 0, opacity: done ? 0.55 : 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, textDecoration: done ? "line-through" : "none" }}>{s.title}</div>
                {s.bodyMd && (
                  <div style={{ marginTop: 3, textDecoration: done ? "line-through" : "none" }}>
                    <SimpleMarkdown md={s.bodyMd} size={12} />
                  </div>
                )}
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 6, flex: "none" }}>
                  {done ? (
                    <button
                      onClick={() => void resolve(s.id, "open")}
                      disabled={busy !== null}
                      title="Click to undo — put this back as not done"
                      style={{ border: "1px solid #BFE6CC", background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Marked complete
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => void resolve(s.id, "done")}
                        disabled={busy !== null}
                        title="I did this"
                        style={{ border: "1px solid #C9D0FB", background: "var(--white)", color: "#2536C4", borderRadius: 999, padding: "3px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        Did it
                      </button>
                      <button
                        onClick={() => void resolve(s.id, "dismissed")}
                        disabled={busy !== null}
                        title="Dismiss — not useful"
                        style={{ border: "1px solid #E2E3E8", background: "var(--white)", color: "var(--muted)", borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}
