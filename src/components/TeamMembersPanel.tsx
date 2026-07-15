"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  INVITABLE_STAFF_ROLES,
  STAFF_ROLE_META,
  type InvitableStaffRole,
} from "@/domain/team";
import type { TeamMemberView } from "@/services/team-members";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 9,
  background: "var(--white)",
  padding: "9px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};

const STATUS_STYLE = {
  invited: { background: "#EEF0FE", color: "#2536C4" },
  active: { background: "#DCF5E3", color: "#15803D" },
  disabled: { background: "#F3F4F6", color: "#6B7280" },
} as const;

export function TeamMembersPanel({ members }: { members: TeamMemberView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableStaffRole>("account_owner");
  const [trainingMode, setTrainingMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/team/members", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, role, trainingMode }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        emailDelivery?: "sent" | "failed" | "development_link";
        inviteLink?: string;
      };
      if (!response.ok) {
        setError(body.message ?? `Could not add member (${response.status}).`);
        return;
      }

      if (body.emailDelivery === "failed") {
        setNotice("Member added, but invitation delivery failed. They can request a one-time link from the login page using the exact invited email.");
      } else if (body.inviteLink) {
        setNotice(
          <>
            Member added. Development invite: <a href={body.inviteLink}>open sign-in link</a>
          </>,
        );
      } else {
        setNotice("Member added and invitation sent.");
      }
      setName("");
      setEmail("");
      setRole("account_owner");
      setTrainingMode(true);
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 1080 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div className="kicker">Team · access</div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 24, fontWeight: 800, letterSpacing: "-.025em" }}>Team members</h1>
          <p style={{ margin: 0, maxWidth: 720, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
            Invite Wahala employees deliberately, assign the least access they need, and use Training mode while they learn the process.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((value) => !value); setError(null); }}
          style={{ border: 0, borderRadius: 9, background: "var(--ink)", color: "var(--white)", padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
        >
          {open ? "Cancel" : "+ Add member"}
        </button>
      </div>

      {notice && (
        <div style={{ marginTop: 14, border: "1px solid #B7E2C4", background: "#F4FBF7", color: "#166534", borderRadius: 10, padding: "10px 12px", fontSize: 12.5 }}>
          {notice}
        </div>
      )}

      {open && (
        <form onSubmit={submit} style={{ marginTop: 16, background: "var(--white)", border: "1.5px solid var(--cobalt)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Add a Wahala team member</div>
          <p style={{ margin: "4px 0 16px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Google sign-in works only when this is the member&apos;s primary Google address. Email aliases such as <code>name+trainee@…</code> must use the invitation or one-time email link.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 1.35fr) minmax(210px, 1fr)", gap: 12 }}>
            <label style={{ display: "block" }}>
              <span className="kicker" style={{ display: "block", marginBottom: 5 }}>Name</span>
              <input style={inputStyle} value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} placeholder="Adam — Trainee" />
            </label>
            <label style={{ display: "block" }}>
              <span className="kicker" style={{ display: "block", marginBottom: 5 }}>Login email</span>
              <input style={inputStyle} value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoCapitalize="none" autoComplete="off" placeholder="adam+trainee@wahalagroup.com" />
            </label>
            <label style={{ display: "block" }}>
              <span className="kicker" style={{ display: "block", marginBottom: 5 }}>Role</span>
              <select style={inputStyle} value={role} onChange={(event) => setRole(event.target.value as InvitableStaffRole)}>
                {INVITABLE_STAFF_ROLES.map((value) => (
                  <option key={value} value={value}>{STAFF_ROLE_META[value].label}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 10, borderRadius: 9, background: "var(--surface-soft)", padding: "9px 11px", fontSize: 12, color: "var(--muted)" }}>
            <strong style={{ color: "var(--ink)" }}>{STAFF_ROLE_META[role].label}:</strong> {STAFF_ROLE_META[role].description}
          </div>

          <label style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
            <input type="checkbox" checked={trainingMode} onChange={(event) => setTrainingMode(event.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              <strong>Start in Training mode</strong><br />
              <span style={{ color: "var(--muted)" }}>Shows process guidance and identifies the member as ramping on the Team scorecard.</span>
            </span>
          </label>

          {role === "wahala_admin" && (
            <div style={{ marginTop: 12, border: "1px solid #FADCB4", background: "#FFF7ED", color: "#92400E", borderRadius: 9, padding: "9px 11px", fontSize: 12.5 }}>
              Admin grants access to every customer account, pricing and payment controls, settings, and team invitations.
            </div>
          )}
          {error && <div style={{ marginTop: 12, color: "#B91C1C", fontSize: 12.5 }}>{error}</div>}

          <div style={{ marginTop: 15, display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 9, background: "var(--cobalt)", color: "var(--white)", padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.65 : 1 }}>
              {busy ? "Adding…" : "Add member & send invite"}
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: 18, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div className="kicker" style={{ display: "grid", gridTemplateColumns: "1.25fr 1.35fr 1fr .7fr", gap: 12, padding: "10px 16px", background: "var(--surface-soft)", borderBottom: "1px solid var(--border)" }}>
          <span>Member</span><span>Email</span><span>Access</span><span>Status</span>
        </div>
        {members.map((member, index) => {
          const statusStyle = STATUS_STYLE[member.status];
          return (
            <div key={member.id} style={{ display: "grid", gridTemplateColumns: "1.25fr 1.35fr 1fr .7fr", gap: 12, alignItems: "center", padding: "12px 16px", borderTop: index === 0 ? 0 : "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{member.name}</div>
                {member.trainingMode && <span className="mono" style={{ fontSize: 8.5, fontWeight: 800, color: "var(--cobalt-text)" }}>TRAINING MODE</span>}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", overflowWrap: "anywhere" }}>{member.email}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{member.roleLabel}</div>
              <div>
                <span className="mono" style={{ ...statusStyle, display: "inline-block", borderRadius: 999, padding: "3px 8px", fontSize: 9, fontWeight: 800, textTransform: "uppercase" }}>{member.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
