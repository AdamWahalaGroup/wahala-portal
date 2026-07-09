"use client";

/**
 * Contact detail page cards (Interactive v3 → Contacts detail screen, founder
 * screenshot 09 Jul): DETAILS (shared-record editor — edits apply everywhere),
 * PORTAL ACCESS (invite state + resend), COMPANY (attach/detach the current
 * account — "attaching links both ways").
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const cardStyle: React.CSSProperties = { background: "var(--white)", border: "1px solid #EDEDF1", borderRadius: 12, padding: "16px 18px" };
const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #E2E3E8", borderRadius: 8, padding: "8px 11px", fontSize: 13.5, background: "var(--surface)", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#9AA0AA", paddingTop: 9 };

export function ContactDetailsCard({
  contactId,
  initial,
  editable,
}: {
  contactId: string;
  initial: { name: string; email: string; title: string; source: string };
  editable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const dirty = form.name !== initial.name || form.email !== initial.email || form.title !== initial.title || form.source !== initial.source;

  async function save() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, title: form.title, source: form.source }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setFlash(data.message ?? `Failed (${res.status}).`);
      else {
        setFlash("Saved ✓");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string) => (
    <>
      <span className="mono" style={labelStyle}>{label}</span>
      <input value={form[key]} disabled={!editable || busy} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
    </>
  );

  return (
    <section style={cardStyle}>
      <div className="kicker" style={{ marginBottom: 12 }}>Details — edits apply everywhere</div>
      <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: "10px 14px", alignItems: "start" }}>
        {field("name", "Name")}
        {field("email", "Email")}
        {field("title", "Role")}
        {field("source", "Source")}
      </div>
      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <button
            onClick={() => void save()}
            disabled={busy || !dirty || !form.name.trim()}
            style={{ background: dirty ? "var(--ink)" : "#F1F2F4", color: dirty ? "var(--white)" : "#9AA0AA", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: dirty ? "pointer" : "default" }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
          {flash && (
            <span className="mono" style={{ fontSize: 10.5, color: flash === "Saved ✓" ? "#15803D" : "#b00020" }}>{flash}</span>
          )}
        </div>
      )}
    </section>
  );
}

export function PortalAccessCard({
  email,
  organizationId,
  contactId,
  portal,
  canManage,
}: {
  email: string | null;
  organizationId: string | null;
  contactId: string;
  portal: "none" | "invited" | "active" | "disabled";
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const PILL: Record<string, { bg: string; border: string; color: string; label: string }> = {
    none: { bg: "#F1F2F4", border: "#E2E3E8", color: "#6B7280", label: "Not on the portal" },
    invited: { bg: "#FFF7ED", border: "#FADCB4", color: "#B45309", label: "Invited — no login yet" },
    active: { bg: "#DCF5E3", border: "#BFE6CC", color: "#15803D", label: "On the portal" },
    disabled: { bg: "#FBE3E3", border: "#F4CFCF", color: "#B91C1C", label: "Access disabled" },
  };
  const pill = PILL[portal];
  // No invite yet → the card itself nudges: this is the next step (no auto-invite on create).
  const nudge = portal === "none" && canManage;

  async function resend() {
    if (!email) return;
    setBusy(true);
    setNote(null);
    try {
      // The invite IS a magic link — re-requesting one re-sends it.
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setNote(res.ok ? "Sign-in link re-sent ✓" : "Couldn't send — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (!organizationId) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/accounts/${organizationId}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invites: [{ contactId }] }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setNote(data.message ?? "Couldn't invite — try again.");
      else {
        setNote("Invite sent ✓");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={nudge ? { ...cardStyle, background: "#FAFBFF", border: "1.5px solid #C9D0FB" } : cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span className="kicker" style={nudge ? { color: "#5A6BD8" } : undefined}>Portal access</span>
        {nudge && (
          <span className="mono" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".06em", background: "var(--cobalt)", color: "var(--white)", borderRadius: 5, padding: "2px 7px" }}>
            NEXT STEP
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: pill.color, background: pill.bg, border: `1px solid ${pill.border}`, padding: "5px 12px", borderRadius: 999 }}>
          {pill.label}
        </span>
        <span style={{ flex: 1 }} />
        {canManage && portal === "invited" && email && (
          <button onClick={() => void resend()} disabled={busy} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {busy ? "Sending…" : "Resend invite"}
          </button>
        )}
        {canManage && portal === "none" && email && organizationId && (
          <button onClick={() => void invite()} disabled={busy} style={{ background: "var(--cobalt)", color: "var(--white)", border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {busy ? "Inviting…" : "✉ Invite to portal"}
          </button>
        )}
      </div>
      <div className="mono" style={{ fontSize: 10, color: nudge ? "#5A6BD8" : "var(--muted-line)", marginTop: 10 }}>
        {portal === "invited" && email
          ? `sent to ${email} — not accepted yet`
          : portal === "active" && email
            ? `signs in as ${email}`
            : !email
              ? "no invite went out on create — add an email above, then invite them"
              : !organizationId
                ? "no invite went out on create — attach an account below, then invite them"
                : "no invite went out on create — send it when you're ready"}
      </div>
      {note && <div className="mono" style={{ fontSize: 10.5, color: note.includes("✓") ? "#15803D" : "#b00020", marginTop: 8 }}>{note}</div>}
    </section>
  );
}

export function CompanyCard({
  contactId,
  organizationId,
  organizationName,
  organizationStatus,
  canManage,
}: {
  contactId: string;
  organizationId: string | null;
  organizationName: string | null;
  organizationStatus: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<{ id: string; name: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((raw) => {
        const d = raw as { clients?: { org: { id: string; name: string; status: string } }[] };
        setAccounts((d.clients ?? []).map((c) => c.org));
      })
      .catch(() => setAccounts([]));
  }, [canManage]);

  async function attach(orgId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "attach_account", organizationId: orgId }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = organizationStatus === "prospect" ? "prospect" : organizationStatus === "active" ? "client" : organizationStatus ?? "";

  return (
    <section style={cardStyle}>
      <div className="kicker" style={{ marginBottom: 12 }}>Company</div>
      {canManage ? (
        <select
          value={organizationId ?? ""}
          disabled={busy}
          onChange={(e) => void attach(e.target.value || null)}
          style={{ width: "100%", border: "1px solid #E2E3E8", borderRadius: 9, padding: "10px 11px", fontSize: 13.5, fontWeight: 600, background: "var(--white)", color: "var(--ink)" }}
        >
          <option value="">no account yet</option>
          {/* keep the current org selectable even if the list hasn't loaded */}
          {organizationId && !accounts.some((a) => a.id === organizationId) && (
            <option value={organizationId}>{organizationName ?? "Current account"}{statusLabel ? ` · ${statusLabel}` : ""}</option>
          )}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.status === "prospect" ? "prospect" : a.status === "active" ? "client" : a.status}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{organizationName ? `${organizationName}${statusLabel ? ` · ${statusLabel}` : ""}` : "no account yet"}</div>
      )}
      {organizationId && (
        <Link href={`/dashboard/accounts/${organizationId}`} style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none" }}>
          Open {organizationName ?? "account"} →
        </Link>
      )}
      <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 10, lineHeight: 1.6 }}>
        an account always hangs off at least one contact — attaching links both ways
      </div>
      {error && <div className="mono" style={{ fontSize: 10.5, color: "#b00020", marginTop: 8 }}>{error}</div>}
    </section>
  );
}
