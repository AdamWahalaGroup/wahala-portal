"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Item = { id: string; description: string };
type Epic = { id: string; name: string; items: Item[] };

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
const uid = () => `k${seq++}`;
const newItem = (description = ""): Item => ({ id: uid(), description });
const newEpic = (name = ""): Epic => ({ id: uid(), name, items: [newItem()] });

/** Dollars string ("2,500" / "2500.50") → integer cents. NaN/blank → 0. */
function toCents(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

/** Build the initial epic groups from saved deliverables (grouped by epic label). */
function initialEpics(items: { description: string; groupLabel: string | null }[]): Epic[] {
  if (items.length === 0) return [newEpic()];
  const epics: Epic[] = [];
  for (const li of items) {
    const name = li.groupLabel ?? "";
    let e = epics.find((x) => x.name === name);
    if (!e) {
      e = { id: uid(), name, items: [] };
      epics.push(e);
    }
    e.items.push(newItem(li.description));
  }
  return epics;
}

/** Quote / scope builder (design frame 06) — set a stage's ONE fixed price and its
 *  deliverables, grouped by epic (description only; no per-item price). */
export function QuoteBuilder({
  stageId,
  projectId,
  initialName,
  initialScope,
  initialItems,
  initialTotalCents,
  initialBillingMode,
  thresholdCents,
  isAdmin,
}: {
  stageId: string;
  projectId: string;
  initialName: string;
  initialScope: string;
  initialItems: { description: string; estimateNote: string | null; amountCents: number; groupLabel: string | null }[];
  initialTotalCents: number;
  initialBillingMode: "upfront" | "on_delivery";
  thresholdCents: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [scope, setScope] = useState(initialScope);
  const [price, setPrice] = useState(initialTotalCents ? String(initialTotalCents / 100) : "");
  const [billingMode, setBillingMode] = useState<"upfront" | "on_delivery">(initialBillingMode);
  const [epics, setEpics] = useState<Epic[]>(() => initialEpics(initialItems));
  const [drag, setDrag] = useState<{ epicId: string; index: number } | null>(null);
  const [busy, setBusy] = useState<null | "save" | "send" | "cosign">(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cosignRequested, setCosignRequested] = useState(false);

  const dirty = () => setSaved(false);
  const totalCents = toCents(price);
  const nDeliverables = epics.reduce((n, e) => n + e.items.filter((i) => i.description.trim()).length, 0);
  const nEpics = epics.filter((e) => e.items.some((i) => i.description.trim())).length;
  const overThreshold = totalCents > thresholdCents;
  const canSend = !overThreshold || isAdmin;

  function setEpicName(epicId: string, value: string) {
    setEpics((prev) => prev.map((e) => (e.id === epicId ? { ...e, name: value } : e)));
    dirty();
  }
  function setItem(epicId: string, itemId: string, value: string) {
    setEpics((prev) => prev.map((e) => (e.id === epicId ? { ...e, items: e.items.map((i) => (i.id === itemId ? { ...i, description: value } : i)) } : e)));
    dirty();
  }
  function addItem(epicId: string) {
    setEpics((prev) => prev.map((e) => (e.id === epicId ? { ...e, items: [...e.items, newItem()] } : e)));
    dirty();
  }
  function removeItem(epicId: string, itemId: string) {
    setEpics((prev) => prev.map((e) => (e.id === epicId ? { ...e, items: e.items.filter((i) => i.id !== itemId) } : e)));
    dirty();
  }
  function addEpic() {
    setEpics((prev) => [...prev, newEpic()]);
    dirty();
  }
  function removeEpic(epicId: string) {
    setEpics((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== epicId) : prev));
    dirty();
  }
  function dropOn(epicId: string, index: number) {
    setEpics((prev) =>
      prev.map((e) => {
        if (e.id !== epicId || !drag || drag.epicId !== epicId) return e; // reorder within an epic only
        const items = [...e.items];
        const [moved] = items.splice(drag.index, 1);
        items.splice(index, 0, moved);
        return { ...e, items };
      }),
    );
    setDrag(null);
    dirty();
  }

  /** PUT the current draft (flatten epics → deliverables with their epic label). */
  async function save(): Promise<boolean> {
    const lineItems = epics.flatMap((e) =>
      e.items
        .filter((i) => i.description.trim())
        .map((i) => ({ groupLabel: e.name.trim(), description: i.description.trim() })),
    );
    const res = await fetch(`/api/phases/${stageId}/quote`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scopeDescription: scope.trim(), totalAmountCents: toCents(price), billingMode, lineItems }),
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
        // Land on the stage detail as if the staffer re-navigated from scratch —
        // no lingering "editing" state, no unsaved indicator, fresh server data.
        router.push(`/dashboard/phases/${stageId}`);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!name.trim()) return setError("A phase name is required.");
    setBusy("send");
    setError(null);
    try {
      if (!(await save())) return;
      const res = await fetch(`/api/phases/${stageId}/send_quote`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Send failed (${res.status}).`);
        return;
      }
      router.push(`/dashboard/phases/${stageId}`);
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
      const res = await fetch(`/api/phases/${stageId}/quote`, { method: "POST" });
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
          <span className="kicker">Phase name</span>
          <input
            style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }}
            placeholder="e.g. Phase 1 — Private Beta Foundation"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              dirty();
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, marginTop: 16 }}>
          <span className="kicker">Scope description</span>
          <textarea
            style={{ ...inputStyle, minHeight: 70 }}
            placeholder="What this phase delivers — the client sees this."
            value={scope}
            onChange={(e) => {
              setScope(e.target.value);
              dirty();
            }}
          />
        </label>

        <div className="kicker" style={{ margin: "24px 0 4px" }}>
          Scope by focus area
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
          Group deliverables under a focus area. The phase is one fixed price (set on the right) — deliverables have no individual prices.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {epics.map((epic) => (
            <div key={epic.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <input
                  style={{ ...inputStyle, fontWeight: 700, fontSize: 14.5, border: "1px solid transparent", background: "var(--surface-soft)" }}
                  placeholder="Focus area (e.g. Authentication & Identity)"
                  value={epic.name}
                  onChange={(e) => setEpicName(epic.id, e.target.value)}
                />
                {epics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEpic(epic.id)}
                    aria-label="Remove focus area"
                    title="Remove focus area"
                    style={{ background: "transparent", border: "none", color: "var(--muted-line)", cursor: "pointer", fontSize: 15, flex: "none" }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {epic.items.map((item, i) => (
                  <div
                    key={item.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOn(epic.id, i)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "18px minmax(0,1fr) 24px",
                      alignItems: "center",
                      gap: 6,
                      opacity: drag && drag.epicId === epic.id && drag.index === i ? 0.4 : 1,
                    }}
                  >
                    <span
                      draggable
                      onDragStart={() => setDrag({ epicId: epic.id, index: i })}
                      onDragEnd={() => setDrag(null)}
                      title="Drag to reorder"
                      style={{ cursor: "grab", color: "var(--muted-line)", fontSize: 15, textAlign: "center", userSelect: "none" }}
                    >
                      ⠿
                    </span>
                    <input
                      style={inputStyle}
                      placeholder="Describe the deliverable"
                      value={item.description}
                      onChange={(e) => setItem(epic.id, item.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(epic.id, item.id)}
                      aria-label="Remove deliverable"
                      style={{ background: "transparent", border: "none", color: "var(--muted-line)", cursor: "pointer", fontSize: 15 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addItem(epic.id)}
                style={{ marginTop: 8, width: "100%", padding: "8px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "transparent", border: "1.5px dashed var(--border)", borderRadius: 9, cursor: "pointer" }}
              >
                + Add deliverable
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addEpic}
          style={{ marginTop: 14, width: "100%", padding: "11px 12px", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}
        >
          + Add focus area
        </button>
      </div>

      {/* Summary rail */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-card)" }}>
          <div className="kicker">Phase price · fixed</div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 4 }}>
            <span className="tabular" style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>$</span>
            <input
              className="tabular"
              inputMode="decimal"
              placeholder="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                dirty();
              }}
              style={{ ...inputStyle, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", padding: "2px 4px", border: "1px solid transparent", background: "transparent" }}
            />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            {nEpics} focus area{nEpics === 1 ? "" : "s"} · {nDeliverables} deliverable{nDeliverables === 1 ? "" : "s"} · the client pays this one fixed price
          </div>
        </div>

        {/* Billing mode — locked in at Quote time; the acceptance flow enforces it. */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
          <div className="kicker" style={{ marginBottom: 8 }}>Billing</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="billingMode"
                value="upfront"
                checked={billingMode === "upfront"}
                onChange={() => { setBillingMode("upfront"); dirty(); }}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Pay upfront</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>
                  Client pays after approving the quote; work starts on paid.
                </span>
              </span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="billingMode"
                value="on_delivery"
                checked={billingMode === "on_delivery"}
                onChange={() => { setBillingMode("on_delivery"); dirty(); }}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>Pay on delivery</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.45 }}>
                  Work starts as soon as the quote is approved; mark paid whenever the money lands. Client can&apos;t accept until it&apos;s paid.
                </span>
              </span>
            </label>
          </div>
        </div>

        {overThreshold && (
          <div style={{ background: "#FFFAF2", border: "1px solid #FADCB4", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: "#92400e" }}>Over {formatCents(thresholdCents)} — admin co-sign required</div>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "#b45309", lineHeight: 1.5 }}>
              {isAdmin
                ? "You're a Wahala admin, so you can send this quote."
                : "Only a Wahala admin can send a quote this size. Request a co-sign — an admin can review and send it from the phase."}
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
              style={{ borderRadius: 9, padding: "11px 16px", fontSize: 14, fontWeight: 600, border: "1px solid var(--ink)", background: "var(--white)", color: "var(--ink)", cursor: busy !== null || cosignRequested ? "default" : "pointer" }}
            >
              {cosignRequested ? "Co-sign requested ✓" : busy === "cosign" ? "Requesting…" : "Request admin co-sign"}
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={busy !== null}
            style={{ borderRadius: 9, padding: "11px 16px", fontSize: 14, fontWeight: 600, border: "1px solid var(--border)", background: "var(--white)", color: "var(--ink)", cursor: busy !== null ? "default" : "pointer" }}
          >
            {busy === "save" ? "Saving…" : saved ? "Saved ✓" : "Save draft"}
          </button>

          <a href={`/dashboard/projects/${projectId}`} style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", padding: "4px 0", textDecoration: "none" }}>
            Cancel
          </a>
        </div>

        {error && <p style={{ color: "#b00020", fontSize: 13, margin: 0 }}>{error}</p>}
      </aside>
    </div>
  );
}
