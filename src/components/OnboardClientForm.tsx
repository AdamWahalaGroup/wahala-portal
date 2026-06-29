"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 14,
  border: "1px solid var(--border)",
  borderRadius: 9,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

/** Onboard a prospect + send an invite. POSTs to /api/clients (admin only). */
export function OnboardClientForm({ staff, currentUserId }: { staff: { id: string; name: string }[]; currentUserId: string }) {
  const router = useRouter();
  const [org, setOrg] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [agent, setAgent] = useState(currentUserId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInviteLink(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationName: org.trim(),
          contactName: name.trim(),
          contactEmail: email.trim(),
          intakeNotes: notes.trim(),
          assignedAgentId: agent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; inviteLink?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        return;
      }
      // No inline success text — the new client row that appears in the list below
      // (with its Invited pill) is the confirmation. We just clear the form + refresh.
      setInviteLink(data.inviteLink ?? null);
      setOrg("");
      setName("");
      setEmail("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
      <input style={input} placeholder="Company / client name" value={org} onChange={(e) => setOrg(e.target.value)} required />
      <div style={{ display: "flex", gap: 10 }}>
        <input style={input} placeholder="Primary contact name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input style={input} type="email" placeholder="Contact email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <textarea
        style={{ ...input, minHeight: 74 }}
        placeholder="What are they looking for? (intake notes)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label style={{ display: "grid", gap: 5 }}>
        <span className="kicker">Assigned agent (account owner)</span>
        <select style={input} value={agent} onChange={(e) => setAgent(e.target.value)}>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === currentUserId ? `${s.name} (you)` : s.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button
          type="submit"
          disabled={busy}
          style={{ border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 600, background: "var(--ink)", color: "var(--white)", cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "Inviting…" : "Invite client"}
        </button>
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 13.5, margin: 0 }}>{error}</p>}
      {inviteLink && (
        <p style={{ fontSize: 13, margin: 0 }}>
          <span className="kicker">dev invite link</span>
          <br />
          <a href={inviteLink}>{inviteLink}</a>
        </p>
      )}
    </form>
  );
}
