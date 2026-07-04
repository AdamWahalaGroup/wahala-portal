"use client";

/**
 * Invite to portal (frame 35) — the portal-invite moment, moved out of the retired
 * Clients screen into the deal→project handoff (right after Create project →) and
 * the Account page. One row per contact: checkbox, avatar, name + mono email, role
 * select. A contact with no email shows the amber dashed "⚠ add email to invite"
 * chip (the chip IS the input trigger). Send = magic-link email per contact;
 * Invited → Accepted states use the existing invite machinery.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/People";

type InvitableContact = {
  id: string;
  name: string;
  email: string | null;
  isPrimary: boolean;
  portal: "none" | "invited" | "active" | "disabled";
};

const ROLES = [
  { value: "client_admin", label: "Client admin" },
  { value: "client_billing", label: "Billing" },
  { value: "client_readonly", label: "Read-only" },
] as const;

export function PortalInviteModal({
  orgId,
  accountName,
  success,
  onClose,
}: {
  orgId: string;
  accountName: string;
  /** Green success strip after Create project → (frame 35's trigger A). */
  success?: { projectName: string; stagesN: number; depositPaid: boolean } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [contacts, setContacts] = useState<InvitableContact[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [emailEdit, setEmailEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/accounts/${orgId}/contacts`)
      .then((r) => (r.ok ? r.json() : { contacts: [] }))
      .then((raw) => {
        const d = raw as { contacts?: InvitableContact[] };
        setContacts(d.contacts ?? []);
      })
      .catch(() => setContacts([]));
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveEmail(contactId: string) {
    const email = emailEdit[contactId]?.trim();
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? "Failed to save email.");
      } else {
        setEmailEdit((m) => {
          const n = { ...m };
          delete n[contactId];
          return n;
        });
        load();
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const invites = (contacts ?? [])
      .filter((c) => checked[c.id] && c.email && c.portal === "none")
      .map((c) => ({ contactId: c.id, role: roles[c.id] ?? "client_admin" }));
    if (invites.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${orgId}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invites }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string; invited?: number; skipped?: string[] };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else {
        setResult(`Invited ${d.invited ?? invites.length} — magic-link email sent. Invited flips to Accepted on first sign-in.`);
        load();
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const checkedN = (contacts ?? []).filter((c) => checked[c.id] && c.email && c.portal === "none").length;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 85, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "6vh 16px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Invite ${accountName} to the portal`}
        style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 560, padding: "20px 22px" }}
      >
        {/* Success strip (after Create project →) */}
        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#DCF5E3", border: "1px solid #BFE6CC", borderRadius: 10, padding: "10px 13px", marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16A34A", flex: "none" }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#15803D", flex: 1, minWidth: 0 }}>
              {success.projectName}
            </span>
            <span className="mono" style={{ fontSize: 10, color: "#15803D", flex: "none" }}>
              {success.stagesN} stage{success.stagesN === 1 ? "" : "s"}
              {success.depositPaid ? " · Stage 1 Paid via deposit" : ""}
            </span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>Invite {accountName} to the portal</h2>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>
              they see projects, phases &amp; messages — never the pipeline
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 16, cursor: "pointer", padding: 2 }}>
            ×
          </button>
        </div>

        {/* Contact rows */}
        <div style={{ marginTop: 14 }}>
          {contacts === null ? (
            <p className="mono" style={{ fontSize: 11, color: "var(--muted-line)" }}>loading contacts…</p>
          ) : contacts.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No contacts on this account yet — add one on the Account page first.</p>
          ) : (
            contacts.map((c) => {
              const invitable = !!c.email && c.portal === "none";
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-softer)" }}>
                  <input
                    type="checkbox"
                    checked={!!checked[c.id] && invitable}
                    disabled={!invitable || busy}
                    onChange={(e) => setChecked((m) => ({ ...m, [c.id]: e.target.checked }))}
                    style={{ width: 16, height: 16, flex: "none", accentColor: "#2B3EE6" }}
                    aria-label={`Invite ${c.name}`}
                  />
                  <Avatar name={c.name} size={30} variant={c.isPrimary ? "owner" : "default"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                    {c.email ? (
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div>
                    ) : emailEdit[c.id] !== undefined ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                        <input
                          autoFocus
                          style={{ border: "1px solid #d7d9df", borderRadius: 7, padding: "4px 8px", fontSize: 12, flex: 1, minWidth: 0 }}
                          placeholder="email@company.com"
                          inputMode="email"
                          value={emailEdit[c.id]}
                          onChange={(e) => setEmailEdit((m) => ({ ...m, [c.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && saveEmail(c.id)}
                        />
                        <button onClick={() => saveEmail(c.id)} disabled={busy} style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flex: "none" }}>
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEmailEdit((m) => ({ ...m, [c.id]: "" }))}
                        className="mono"
                        style={{ border: "1px dashed #FADCB4", background: "#FFF7ED", color: "#B45309", fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "2px 8px", cursor: "pointer", marginTop: 3 }}
                      >
                        ⚠ add email to invite
                      </button>
                    )}
                  </div>
                  {c.portal !== "none" ? (
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: c.portal === "active" ? "#15803D" : c.portal === "invited" ? "#B45309" : "var(--muted-line)", flex: "none" }}>
                      {c.portal === "active" ? "on the portal ✓" : c.portal}
                    </span>
                  ) : (
                    <select
                      value={roles[c.id] ?? "client_admin"}
                      disabled={busy || !invitable}
                      onChange={(e) => setRoles((m) => ({ ...m, [c.id]: e.target.value }))}
                      style={{ border: "1px solid #E2E3E8", borderRadius: 8, padding: "5px 7px", fontSize: 11.5, fontWeight: 600, background: "var(--white)", flex: "none" }}
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })
          )}
        </div>

        {result && <p style={{ color: "#15803d", fontSize: 12.5, fontWeight: 600, margin: "12px 0 0" }}>{result}</p>}
        {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flex: "1 1 30%" }}
          >
            {result ? "Done" : "Skip for now"}
          </button>
          <button
            onClick={send}
            disabled={busy || checkedN === 0}
            style={{
              background: checkedN > 0 ? "var(--ink)" : "#B4B9C1",
              color: "var(--white)",
              border: "none",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: checkedN > 0 && !busy ? "pointer" : "default",
              flex: "2 1 50%",
            }}
          >
            {busy ? "Sending…" : `Send portal invite${checkedN > 1 ? "s" : ""} →`}
          </button>
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", textAlign: "center", marginTop: 9 }}>
          magic-link email · Invited → Accepted on first sign-in
        </div>
      </div>
    </div>
  );
}
