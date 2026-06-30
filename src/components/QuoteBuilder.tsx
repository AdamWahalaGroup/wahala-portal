"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Row = { id: string; group: string; description: string; estimateNote: string; amount: string };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 14,
  border: "1px solid var(--border)",
  borderRadius: 9,
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "var(--white)",
};

let seq = 0;
const newRow = (group = ""): Row => ({ id: `r${seq++}`, group, description: "", estimateNote: "", amount: "" });

/** Dollars string ("2,500" / "2500.50") → integer cents. NaN/blank → 0. */
function toCents(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

/** Quote / scope builder (design frame 06). Edits a DRAFT stage's itemized quote. */
export function QuoteBuilder({
  stageId,
  projectId,
  initialName,
  initialScope,
  initialItems,
  initialTotalCents,
  thresholdCents,
  isAdmin,
}: {
  stageId: string;
  projectId: string;
  initialName: string;
  initialScope: string;
  initialItems: { description: string; estimateNote: string | null; amountCents: number; groupLabel: string | null }[];
  initialTotalCents: number;
  thresholdCents: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [scope, setScope] = useState(initialScope);
  const [price, setPrice] = useState(initialTotalCents ? String(initialTotalCents / 100) : "");
  const [rows, setRows] = useState<Row[]>(
    initialItems.length
      ? initialItems.map((li) => ({
          id: `r${seq++}`,
          group: li.groupLabel ?? "",
          description: li.description,
          estimateNote: li.estimateNote ?? "",
          amount: li.amountCents ? String(li.amountCents / 100) : "",
        }))
      : [newRow()],
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "save" | "send" | "cosign">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cosignRequested, setCosignRequested] = useState(false);

  // The stage price is author-set (the fixed chunk price). The item sum is just a hint.
  const totalCents = toCents(price);
  const itemsSum = useMemo(
    () => rows.reduce((sum, r) => sum + (r.description.trim() ? toCents(r.amount) : 0), 0),
    [rows],
  );
  const nDeliverables = rows.filter((r) => r.description.trim()).length;
  const overThreshold = totalCents > thresholdCents;
  const canSend = !overThreshold || isAdmin;

  function patchRow(id: string, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    setSaved(false);
  }
  function addRow(group = "") {
    setRows((prev) => [...prev, newRow(group)]);
    setSaved(false);
  }
  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
    setSaved(false);
  }
  function moveTo(target: number) {
    setRows((prev) => {
      if (dragIdx === null || dragIdx === target || dragIdx < 0 || dragIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setDragIdx(null);
    setSaved(false);
  }

  /** PUT the current draft. Returns true on success. */
  async function save(): Promise<boolean> {
    const res = await fetch(`/api/stages/${stageId}/quote`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        scopeDescription: scope.trim(),
        totalAmountCents: toCents(price),
        lineItems: rows
          .filter((r) => r.description.trim())
          .map((r) => ({
            groupLabel: r.group.trim(),
            description: r.description.trim(),
            estimateNote: r.estimateNote.trim(),
            amountCents: toCents(r.amount),
          })),
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? `Save failed (${res.status}).`);
      return false;
    }
    return true;
  }

  async function onSave() {
    setBusy("save");
    setError(null);
    try {
      if (await save()) {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!name.trim()) return setError("A stage name is required.");
    setBusy("send");
    setError(null);
    try {
      if (!(await save())) return;
      const res = await fetch(`/api/stages/${stageId}/send_quote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Send failed (${res.status}).`);
        return;
      }
      router.push(`/dashboard/stages/${stageId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onRequestCosign() {
    setBusy("cosign");
    setError(null);
    try {
      if (!(await save())) return;
      const res = await fetch(`/api/stages/${stageId}/quote`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Request failed (${res.status}).`);
        return;
      }
      setCosignRequested(true);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 30, alignItems: "start" }}>
      {/* Editor */}
      <div>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="kicker">Stage name</span>
          <input
            style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
            placeholder="e.g. Discovery & scope"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginTop: 16 }}>
          <span className="kicker">Scope description</span>
          <textarea
            style={{ ...inputStyle, minHeight: 76 }}
            placeholder="What this stage delivers — the client sees this."
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              setSaved(false);
            }}
          />
        </label>

        <div className="kicker" style={{ margin: "24px 0 4px" }}>
          Deliverables
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--muted)" }}>
          What this phase delivers. Tag each with an <strong>epic</strong> to group them; per-item amounts are optional
          (the stage price is set on the right).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => moveTo(i)}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 132px minmax(0,1fr) 110px 28px",
                alignItems: "start",
                gap: 8,
                opacity: dragIdx === i ? 0.4 : 1,
              }}
            >
              <span
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnd={() => setDragIdx(null)}
                title="Drag to reorder"
                style={{ cursor: "grab", color: "var(--muted-line)", fontSize: 16, textAlign: "center", userSelect: "none", paddingTop: 9 }}
              >
                ⠿
              </span>
              <input
                style={{ ...inputStyle, fontSize: 12.5, padding: "9px 9px" }}
                placeholder="Epic (optional)"
                value={r.group}
                onChange={(e) => patchRow(r.id, "group", e.target.value)}
              />
              <div>
                <input
                  style={inputStyle}
                  placeholder="Describe the deliverable"
                  value={r.description}
                  onChange={(e) => patchRow(r.id, "description", e.target.value)}
                />
                <input
                  style={{ ...inputStyle, marginTop: 5, fontSize: 12.5, padding: "6px 11px", color: "var(--muted)" }}
                  placeholder="Estimate note (optional)"
                  value={r.estimateNote}
                  onChange={(e) => patchRow(r.id, "estimateNote", e.target.value)}
                />
              </div>
              <input
                className="tabular"
                style={{ ...inputStyle, textAlign: "right" }}
                inputMode="decimal"
                placeholder="$0"
                value={r.amount}
                onChange={(e) => patchRow(r.id, "amount", e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                aria-label="Remove deliverable"
                style={{ background: "transparent", border: "none", color: "var(--muted-line)", cursor: "pointer", fontSize: 16, lineHeight: 1, paddingTop: 9 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addRow(rows[rows.length - 1]?.group ?? "")}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--muted)",
            background: "transparent",
            border: "1.5px dashed var(--border)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          + Add deliverable
        </button>
      </div>

      {/* Summary rail */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-card)" }}>
          <div className="kicker">Stage price</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
            <span className="tabular" style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>$</span>
            <input
              className="tabular"
              inputMode="decimal"
              placeholder="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                setSaved(false);
              }}
              style={{ ...inputStyle, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", padding: "2px 4px", border: "1px solid transparent", background: "transparent" }}
            />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            {nDeliverables} deliverable{nDeliverables === 1 ? "" : "s"}
            {itemsSum > 0 ? ` · items add up to ${formatCents(itemsSum)}` : ""}
          </div>
        </div>

        {overThreshold && (
          <div style={{ background: "#FFFAF2", border: "1px solid #FADCB4", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#92400e" }}>
              Over {formatCents(thresholdCents)} — admin co-sign required
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#b45309", lineHeight: 1.5 }}>
              {isAdmin
                ? "You're a Wahala admin, so you can send this quote."
                : "Only a Wahala admin can send a quote this size. Request a co-sign — an admin can review and send it from the stage."}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <button
            type="button"
            onClick={onSend}
            disabled={busy !== null || !canSend}
            style={{
              borderRadius: 9,
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: busy !== null || !canSend ? "default" : "pointer",
              background: canSend ? "var(--ink)" : "var(--surface)",
              color: canSend ? "var(--white)" : "var(--muted-line)",
            }}
          >
            {busy === "send" ? "Sending…" : canSend ? "Send quote" : "Send quote — awaiting co-sign"}
          </button>

          {overThreshold && !isAdmin && (
            <button
              type="button"
              onClick={onRequestCosign}
              disabled={busy !== null || cosignRequested}
              style={{
                borderRadius: 9,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid var(--ink)",
                background: "var(--white)",
                color: "var(--ink)",
                cursor: busy !== null || cosignRequested ? "default" : "pointer",
              }}
            >
              {cosignRequested ? "Co-sign requested ✓" : busy === "cosign" ? "Requesting…" : "Request admin co-sign"}
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={busy !== null}
            style={{
              borderRadius: 9,
              padding: "11px 16px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid var(--border)",
              background: "var(--white)",
              color: "var(--ink)",
              cursor: busy !== null ? "default" : "pointer",
            }}
          >
            {busy === "save" ? "Saving…" : saved ? "Saved ✓" : "Save draft"}
          </button>

          <a
            href={`/dashboard/projects/${projectId}`}
            style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", padding: "4px 0", textDecoration: "none" }}
          >
            Cancel
          </a>
        </div>

        {error && <p style={{ color: "#b00020", fontSize: 13, margin: 0 }}>{error}</p>}
      </aside>
    </div>
  );
}
