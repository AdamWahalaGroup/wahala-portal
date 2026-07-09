"use client";

/**
 * "+ Add account" (founder call, 09 Jul — replaces the Onboard-an-account panel):
 * a bare account with a name + owner, plus optional attachment of EXISTING
 * contacts — the "two standalone people, now their company exists" flow. No
 * invite goes out; that's a deliberate step from each contact's page.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ModalShell } from "@/components/OpportunityModals";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d7d9df",
  borderRadius: 9,
  padding: "9px 11px",
  fontSize: 13.5,
  boxSizing: "border-box",
  background: "var(--white)",
};
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#9aa0aa", margin: "12px 0 5px", fontWeight: 600 };

type ContactRow = { id: string; name: string; email: string | null; organizationId: string | null; organizationName: string | null };

export function AddAccountModal({ currentUserId, onClose }: { currentUserId: string; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState(currentUserId);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => setStaff((d as { staff?: { id: string; name: string }[] }).staff ?? []))
      .catch(() => setStaff([]));
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((d) => setContacts((d as { contacts?: ContactRow[] }).contacts ?? []))
      .catch(() => setContacts([]));
  }, []);

  // Account-less people first — they're who this flow exists for.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? contacts.filter((c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q)) : contacts;
    return [...matches].sort((a, b) => Number(!!a.organizationId) - Number(!!b.organizationId) || a.name.localeCompare(b.name)).slice(0, 8);
  }, [contacts, query]);

  function toggle(id: string) {
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          accountOwnerUserId: owner,
          intakeNotes: notes.trim() || undefined,
          contactIds: [...picked],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; organizationId?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      onClose();
      router.push(data.organizationId ? `/dashboard/accounts/${data.organizationId}` : "/dashboard/accounts");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add account" kicker="one record per organization" onClose={onClose}>
      <label style={labelStyle}>Account name</label>
      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Company / organization" style={inputStyle} />

      <label style={labelStyle}>Account owner</label>
      <select value={owner} onChange={(e) => setOwner(e.target.value)} style={{ ...inputStyle, fontWeight: 600 }}>
        {staff.length === 0 && <option value={currentUserId}>you</option>}
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id === currentUserId ? `${s.name} (you)` : s.name}
          </option>
        ))}
      </select>

      <label style={labelStyle}>Intake notes <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional</span></label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What are they looking for?" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

      <label style={labelStyle}>Attach existing contacts <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional</span></label>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people already on record…" style={inputStyle} />
      {shown.length > 0 && (
        <div style={{ border: "1px solid #E2E3E8", borderRadius: 10, marginTop: 6, maxHeight: 190, overflowY: "auto" }}>
          {shown.map((c, i) => {
            const on = picked.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: 9,
                  border: 0,
                  borderTop: i === 0 ? "none" : "1px solid #F2F3F5",
                  background: on ? "#FAFBFF" : "var(--white)",
                  padding: "8px 11px",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 5,
                    flex: "none",
                    border: on ? "0" : "1.5px solid #C4C8CF",
                    background: on ? "var(--cobalt)" : "var(--white)",
                    color: "var(--white)",
                    fontSize: 11,
                    lineHeight: "16px",
                    textAlign: "center",
                    fontWeight: 800,
                  }}
                >
                  {on ? "✓" : ""}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: c.organizationId ? "#B45309" : "#B4B9C1", flex: "none" }}>
                  {c.organizationId ? `moves from ${c.organizationName ?? "another account"}` : "no account yet"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 6 }}>
        {picked.size > 0
          ? `${picked.size} contact${picked.size === 1 ? "" : "s"} will hang off this account — no invites go out; send those from each contact's page.`
          : "attaching links both ways — pick people created before their company existed"}
      </div>

      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} disabled={busy} style={{ background: "var(--white)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: busy || !name.trim() ? "default" : "pointer", opacity: busy || !name.trim() ? 0.55 : 1 }}
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </div>
    </ModalShell>
  );
}

export function AddAccountButton({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "var(--ink)", color: "var(--white)", border: "1px solid transparent", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: "none" }}
      >
        + Add account
      </button>
      {open && <AddAccountModal currentUserId={currentUserId} onClose={() => setOpen(false)} />}
    </>
  );
}
