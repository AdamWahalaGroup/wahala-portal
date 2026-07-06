"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Action = "send_quote" | "approve" | "reject" | "mark_paid" | "apply" | "decline";
type Item = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalAmountCents: number;
  requiresAdminApproval: boolean;
  taskId: string | null;
  actions: Action[];
};
type TaskOption = { id: string; title: string };

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "#fff7ed", text: "#b45309", label: "Requested" },
  quoted: { bg: "#e8effe", text: "#1d4ed8", label: "Quoted" },
  approved: { bg: "#f1ebfe", text: "#6d28d9", label: "Approved" },
  paid: { bg: "#e1f4f9", text: "#0e7490", label: "Paid" },
  accepted: { bg: "#dcf5e3", text: "#15803d", label: "Applied" },
  rejected: { bg: "#f6dede", text: "#991b1b", label: "Declined" },
};

const ACTION_LABEL: Record<Action, string> = {
  send_quote: "Send quote",
  approve: "Approve",
  reject: "Reject",
  mark_paid: "Mark paid",
  apply: "Apply change",
  decline: "Decline",
};

function toCents(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

const input: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
  background: "var(--white)",
  boxSizing: "border-box",
};

function btn(tone: "ink" | "green" | "red" | "secondary"): React.CSSProperties {
  const base: React.CSSProperties = { borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid transparent" };
  if (tone === "ink") return { ...base, background: "var(--ink)", color: "var(--white)" };
  if (tone === "green") return { ...base, background: "#16a34a", color: "var(--white)" };
  if (tone === "red") return { ...base, background: "var(--white)", color: "#b91c1c", borderColor: "#f0caca" };
  return { ...base, background: "var(--white)", color: "var(--ink)", borderColor: "#d7d9df" };
}
function toneFor(a: Action): "ink" | "green" | "red" | "secondary" {
  if (a === "approve" || a === "apply") return "green";
  if (a === "reject" || a === "decline") return "red";
  if (a === "send_quote" || a === "mark_paid") return "ink";
  return "secondary";
}

/** Change orders on a stage (design: the "I want to make a change" path). */
export function ChangeOrders({ stageId, projectId, items, tasks }: { stageId: string; projectId: string; items: Item[]; tasks: TaskOption[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [quoteAmt, setQuoteAmt] = useState("");
  const [quoteTask, setQuoteTask] = useState("");

  async function request() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/change-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, stageId, name: name.trim(), description: desc.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
        return;
      }
      setName("");
      setDesc("");
      setShowForm(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: Action, extra?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/change-orders/${id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(extra ?? {}),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
        if (res.status === 409) router.refresh();
        return;
      }
      setQuoteFor(null);
      setQuoteAmt("");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <div className="kicker">Changes ({items.length})</div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          style={{ ...btn("secondary"), fontSize: 12.5 }}
        >
          {showForm ? "Cancel" : "Request a change"}
        </button>
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginBottom: 12 }}>
        card payment for changes arrives with milestone billing — until then your Wahala admin marks paid
      </div>

      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <input style={{ ...input, width: "100%" }} placeholder="What do you want to change?" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea style={{ ...input, width: "100%", minHeight: 60, marginTop: 8 }} placeholder="Any detail (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div style={{ marginTop: 10 }}>
            <button type="button" onClick={request} disabled={busy || !name.trim()} style={btn("ink")}>
              {busy ? "Sending…" : "Send change request"}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No change requests on this stage.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((co) => {
            const s = STATUS[co.status] ?? STATUS.draft;
            return (
              <div key={co.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, minWidth: 0 }}>{co.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                    {(co.status === "quoted" || co.status === "approved" || co.status === "paid" || co.status === "accepted") && (
                      <span className="tabular" style={{ fontWeight: 700, fontSize: 13.5 }}>
                        {co.totalAmountCents > 0 ? formatCents(co.totalAmountCents) : "No charge"}
                      </span>
                    )}
                    <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                  </div>
                </div>
                {co.description && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)" }}>{co.description}</p>}

                {/* Inline quote entry (staff): price + which task it attaches to */}
                {quoteFor === co.id ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>$</span>
                    <input
                      className="tabular"
                      style={{ ...input, width: 110, textAlign: "right" }}
                      inputMode="decimal"
                      placeholder="0"
                      value={quoteAmt}
                      onChange={(e) => setQuoteAmt(e.target.value)}
                    />
                    <select style={input} value={quoteTask} onChange={(e) => setQuoteTask(e.target.value)} title="Attach this change to a task">
                      <option value="">No task</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title.length > 36 ? `${t.title.slice(0, 36)}…` : t.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(co.id, "send_quote", { totalAmountCents: toCents(quoteAmt), taskId: quoteTask || undefined })}
                      style={btn("ink")}
                    >
                      Send quote
                    </button>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>0 = absorb · the task shows it as a Change subitem.</span>
                    <button type="button" onClick={() => setQuoteFor(null)} style={btn("secondary")}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  co.actions.length > 0 && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {co.actions.map((a) => (
                        <button
                          key={a}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (a === "send_quote") {
                              setQuoteFor(co.id);
                              setQuoteTask(co.taskId ?? "");
                              setQuoteAmt(co.totalAmountCents ? String(co.totalAmountCents / 100) : "");
                            } else {
                              act(co.id, a);
                            }
                          }}
                          style={btn(toneFor(a))}
                        >
                          {ACTION_LABEL[a]}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
