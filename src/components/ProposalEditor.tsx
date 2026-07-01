"use client";

/**
 * Staff proposal editor (R3). Draft: edit everything, price both options (the AI
 * never prices), then Send — complexity >3 gets a loud banner + a confirm, never a
 * hard block. Sent: share link + record-response controls. Responded: status view.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = {
  id: string;
  label: string;
  name: string;
  summaryMd: string;
  timelineNote: string | null;
  priceCents: number;
  priceNote: string | null;
};

type Proposal = {
  id: string;
  dealId: string;
  version: number;
  status: "draft" | "sent" | "approved" | "declined" | "superseded";
  title: string;
  executiveSummaryMd: string | null;
  assumptionsMd: string | null;
  complexityScore: number | null;
  complexityRationale: string | null;
  needsReview: boolean;
  shareToken: string | null;
  respondedByName: string | null;
  selectedOptionId: string | null;
  options: Option[];
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "9px 11px",
  fontSize: 13.5,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};
const mdStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5,
  lineHeight: 1.55,
  resize: "vertical",
};
const btn = (tone: "ink" | "green" | "plain", disabled: boolean): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 9,
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

export function ProposalEditor({ proposal, canManage }: { proposal: Proposal; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  const [form, setForm] = useState({
    title: proposal.title,
    executiveSummaryMd: proposal.executiveSummaryMd ?? "",
    assumptionsMd: proposal.assumptionsMd ?? "",
    options: proposal.options.map((o) => ({
      ...o,
      priceDollars: o.priceCents > 0 ? String(o.priceCents / 100) : "",
      priceNote: o.priceNote ?? "",
      timelineNote: o.timelineNote ?? "",
    })),
  });
  const [respond, setRespond] = useState({ outcome: "", name: "", note: "" });

  const isDraft = proposal.status === "draft";
  const shareUrl = proposal.shareToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${proposal.shareToken}` : null;

  async function call(url: string, body: unknown, key: string): Promise<Response | null> {
    setBusy(key);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        return null;
      }
      return res;
    } catch {
      setError("Network error — please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveAll() {
    setBusy("save");
    setError(null);
    setStatus(null);
    try {
      const head = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: form.title, executiveSummaryMd: form.executiveSummaryMd, assumptionsMd: form.assumptionsMd }),
      });
      if (!head.ok) {
        const data = (await head.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${head.status}).`);
        return;
      }
      for (const o of form.options) {
        const res = await fetch(`/api/proposals/${proposal.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            option: {
              id: o.id,
              name: o.name,
              summaryMd: o.summaryMd,
              timelineNote: o.timelineNote,
              priceCents: o.priceDollars ? Math.round(parseFloat(o.priceDollars) * 100) : 0,
              priceNote: o.priceNote,
            },
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          setError(data.message ?? `Failed saving Option ${o.label} (${res.status}).`);
          return;
        }
      }
      setStatus("Saved ✓");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setConfirmSend(false);
    const res = await call(`/api/proposals/${proposal.id}/send`, {}, "send");
    if (res) {
      setStatus("Sent — share link is live below.");
      router.refresh();
    }
  }

  async function submitResponse() {
    const approved = respond.outcome.startsWith("approved:");
    const res = await call(
      `/api/proposals/${proposal.id}/respond`,
      {
        outcome: approved ? "approved" : "declined",
        optionId: approved ? respond.outcome.slice("approved:".length) : undefined,
        respondedByName: respond.name || undefined,
        responseNote: respond.note || undefined,
      },
      "respond",
    );
    if (res) router.refresh();
  }

  async function newVersion() {
    const res = await call(`/api/deals/${proposal.dealId}/proposals`, {}, "newversion");
    if (res) {
      const data = (await res.json()) as { proposalId?: string };
      if (data.proposalId) router.push(`/dashboard/sales/proposals/${data.proposalId}`);
    }
  }

  const setOption = (id: string, patch: Partial<(typeof form.options)[number]>) =>
    setForm((f) => ({ ...f, options: f.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  return (
    <div>
      {/* Complexity flag — soft by design */}
      {proposal.needsReview && (
        <div style={{ marginTop: 18, background: "#fff7ed", border: "1px solid #fadcb4", borderRadius: 12, padding: "13px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#b45309" }}>
            ⚠ Complexity {proposal.complexityScore}/5 — the AI thinks this needs engineering review before it goes out.
          </div>
          {proposal.complexityRationale && (
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "#92400e" }}>{proposal.complexityRationale}</p>
          )}
        </div>
      )}
      {!proposal.needsReview && proposal.complexityScore !== null && (
        <div className="mono" style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
          Complexity {proposal.complexityScore}/5 — fast-track territory.{" "}
          {proposal.complexityRationale}
        </div>
      )}

      {/* Sent: share link */}
      {shareUrl && (proposal.status === "sent" || proposal.status === "approved" || proposal.status === "declined") && (
        <div style={{ marginTop: 18, background: "#F5F7FF", border: "1px solid #D9E0F5", borderRadius: 12, padding: "13px 16px" }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Share link — send this to the prospect</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
              {shareUrl}
            </a>
            <button onClick={() => { navigator.clipboard.writeText(shareUrl); setStatus("Link copied ✓"); }} style={btn("plain", false)}>
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Responded banner */}
      {proposal.status === "approved" && (
        <div style={{ marginTop: 18, background: "#e8f7ee", border: "1px solid #bfe8cf", borderRadius: 12, padding: "13px 16px", fontWeight: 700, fontSize: 14, color: "#15803d" }}>
          ✓ Approved{proposal.respondedByName ? ` by ${proposal.respondedByName}` : ""}
          {proposal.selectedOptionId
            ? ` — Option ${proposal.options.find((o) => o.id === proposal.selectedOptionId)?.label ?? "?"}`
            : ""}{" "}
          · deal moved to Contract
        </div>
      )}
      {proposal.status === "declined" && (
        <div style={{ marginTop: 18, background: "#fdeeee", border: "1px solid #f0caca", borderRadius: 12, padding: "13px 16px", fontWeight: 700, fontSize: 14, color: "#b91c1c" }}>
          Declined{proposal.respondedByName ? ` by ${proposal.respondedByName}` : ""} — draft a new version when you&apos;re ready.
        </div>
      )}

      {/* Editor */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 5 }}>Title</div>
          <input style={inputStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} readOnly={!isDraft || !canManage} />
        </div>
        <div>
          <div className="kicker" style={{ marginBottom: 5 }}>Executive summary (markdown — this is what their decision makers read)</div>
          <textarea style={{ ...mdStyle, minHeight: 170 }} value={form.executiveSummaryMd} onChange={(e) => setForm((f) => ({ ...f, executiveSummaryMd: e.target.value }))} readOnly={!isDraft || !canManage} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          {form.options.map((o) => (
            <div key={o.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Option {o.label}</div>
              <input style={{ ...inputStyle, fontWeight: 700 }} value={o.name} onChange={(e) => setOption(o.id, { name: e.target.value })} readOnly={!isDraft || !canManage} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Price ($) — human-set</div>
                  <input style={inputStyle} inputMode="numeric" placeholder="0" value={o.priceDollars} onChange={(e) => setOption(o.id, { priceDollars: e.target.value.replace(/[^0-9.]/g, "") })} readOnly={!isDraft || !canManage} />
                </div>
                <div style={{ flex: 1.4 }}>
                  <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Price note</div>
                  <input style={inputStyle} placeholder="+ $500/mo platform…" value={o.priceNote} onChange={(e) => setOption(o.id, { priceNote: e.target.value })} readOnly={!isDraft || !canManage} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Timeline</div>
                <input style={inputStyle} placeholder="~6–8 weeks" value={o.timelineNote} onChange={(e) => setOption(o.id, { timelineNote: e.target.value })} readOnly={!isDraft || !canManage} />
              </div>
              <textarea style={{ ...mdStyle, minHeight: 200, marginTop: 8 }} value={o.summaryMd} onChange={(e) => setOption(o.id, { summaryMd: e.target.value })} readOnly={!isDraft || !canManage} />
            </div>
          ))}
        </div>

        <div>
          <div className="kicker" style={{ marginBottom: 5 }}>Assumptions (markdown)</div>
          <textarea style={{ ...mdStyle, minHeight: 110 }} value={form.assumptionsMd} onChange={(e) => setForm((f) => ({ ...f, assumptionsMd: e.target.value }))} readOnly={!isDraft || !canManage} />
        </div>
      </div>

      {/* Actions */}
      {canManage && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
          {isDraft && (
            <>
              <button onClick={saveAll} disabled={busy !== null} style={btn("plain", busy !== null)}>
                {busy === "save" ? "Saving…" : "Save draft"}
              </button>
              <button onClick={() => setConfirmSend(true)} disabled={busy !== null} style={btn("ink", busy !== null)}>
                {busy === "send" ? "Sending…" : "Send to client →"}
              </button>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Save first — Send uses what&apos;s stored.</span>
            </>
          )}
          {proposal.status === "sent" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <span className="kicker">Record response</span>
              <select style={{ ...inputStyle, width: "auto" }} value={respond.outcome} onChange={(e) => setRespond((r) => ({ ...r, outcome: e.target.value }))}>
                <option value="">Outcome…</option>
                {proposal.options.map((o) => (
                  <option key={o.id} value={`approved:${o.id}`}>Approved — Option {o.label}</option>
                ))}
                <option value="declined">Declined</option>
              </select>
              <input style={{ ...inputStyle, width: 170 }} placeholder="Who responded" value={respond.name} onChange={(e) => setRespond((r) => ({ ...r, name: e.target.value }))} />
              <input style={{ ...inputStyle, width: 200 }} placeholder="Note (optional)" value={respond.note} onChange={(e) => setRespond((r) => ({ ...r, note: e.target.value }))} />
              <button onClick={submitResponse} disabled={busy !== null || !respond.outcome} style={btn("green", busy !== null || !respond.outcome)}>
                {busy === "respond" ? "Recording…" : "Record"}
              </button>
            </div>
          )}
          {(proposal.status === "sent" || proposal.status === "approved" || proposal.status === "declined" || proposal.status === "superseded") && (
            <button onClick={newVersion} disabled={busy !== null} style={btn("plain", busy !== null)}>
              {busy === "newversion" ? "Drafting…" : "◆ Draft new version with AI"}
            </button>
          )}
        </div>
      )}

      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "10px 0 0" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}

      {/* Send confirm — the soft complexity gate lives here */}
      {confirmSend && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirmSend(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", boxShadow: "var(--shadow-modal)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800 }}>
              {proposal.needsReview ? "Send without engineering review?" : "Send this proposal?"}
            </h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
              {proposal.needsReview
                ? `The AI scored this ${proposal.complexityScore}/5 — above the fast-track line. Sending creates the public share link and supersedes any older open version.`
                : "This creates the public share link the prospect can read and approve, and supersedes any older open version."}
            </p>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setConfirmSend(false)} style={btn("plain", false)}>Cancel</button>
              <button onClick={send} style={btn(proposal.needsReview ? "ink" : "green", false)}>
                {proposal.needsReview ? "Send anyway" : "Send it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
