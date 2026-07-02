"use client";

/**
 * Handoff panel (R5) on the project page — assemble the delivery team: pick the
 * lead engineer + roster, save, done. "You and I do everything up to here, then
 * we hand this off to the B team."
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type Staff = { id: string; name: string };

export function HandoffPanel({
  projectId,
  staff,
  currentLeadId,
  currentEngineerIds,
}: {
  projectId: string;
  staff: Staff[];
  currentLeadId: string | null;
  currentEngineerIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(currentLeadId ?? "");
  const [engineerIds, setEngineerIds] = useState<Set<string>>(new Set(currentEngineerIds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadEngineerUserId: leadId || null, engineerIds: [...engineerIds] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setStatus("Team saved ✓");
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setEngineerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: open ? "var(--surface-soft)" : "var(--white)",
          color: "var(--ink)",
          border: "1px solid #d7d9df",
          borderRadius: 8,
          padding: "7px 13px",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {open ? "Close" : currentLeadId || currentEngineerIds.length > 0 ? "Reshuffle team" : "Hand off to team →"}
      </button>
      {status && !open && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>{status}</span>}

      {open && (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, minWidth: 260 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Lead engineer</div>
          <select
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%" }}
          >
            <option value="">— none yet —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="kicker" style={{ margin: "12px 0 6px" }}>Engineers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {staff.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                <input type="checkbox" checked={engineerIds.has(s.id)} onChange={() => toggle(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
          <button
            onClick={save}
            disabled={busy}
            style={{
              marginTop: 12,
              background: "var(--ink)",
              color: "var(--white)",
              border: "none",
              borderRadius: 8,
              padding: "8px 15px",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Saving…" : "Save team"}
          </button>
          {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "8px 0 0" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
