"use client";

/**
 * Account page right-rail client bits (frame 33): the Contacts card (inline edit —
 * the shared record, "edits apply everywhere"; ⚠ add email chip when a field is
 * missing; "+ add" inline form) and the "+ New deal" header button with its small
 * name/value/contact dialog.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/People";
import { PortalInviteModal } from "@/components/PortalInviteModal";

type RailContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isPrimary: boolean;
  /** Two independent axes on ONE person (QA delta 07-08 §4): sales state + portal access. */
  salesState?: "to_qualify" | "qualified" | "passed";
  portalStatus?: "invited" | "accepted" | null;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 13,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

async function post(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; message?: string; dealId?: string }> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string; dealId?: string };
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, message: "Network error — please try again." };
  }
}

// ---------------------------------------------------------------- contacts card

function ContactRow({ contact, canManage }: { contact: RailContact; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "" });
  const missing = !contact.email;

  async function save() {
    setBusy(true);
    setError(null);
    const r = await post(`/api/contacts/${contact.id}`, form, "PATCH");
    if (!r.ok) setError(r.message ?? "Failed.");
    else {
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--border-softer)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={contact.name} size={32} variant={contact.isPrimary ? "owner" : "default"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {contact.name}
            {contact.isPrimary && <span className="mono" style={{ fontSize: 9, color: "var(--muted-line)" }}>primary</span>}
            {contact.title && <span className="mono" style={{ fontSize: 9, color: "var(--muted-line)" }}>{contact.title}</span>}
            {/* One row, one person, both facts — sales state and portal access are different axes */}
            {contact.salesState === "to_qualify" && (
              <span className="mono" style={{ fontSize: 8.5, fontWeight: 800, background: "#FFF7ED", color: "#B45309", borderRadius: 999, padding: "1px 7px" }}>to qualify</span>
            )}
            {contact.portalStatus === "invited" && (
              <span className="mono" style={{ fontSize: 8.5, fontWeight: 800, background: "#F1F2F4", color: "#767B85", borderRadius: 999, padding: "1px 7px" }}>invited · awaiting first login</span>
            )}
            {contact.portalStatus === "accepted" && (
              <span className="mono" style={{ fontSize: 8.5, fontWeight: 800, background: "#DCF5E3", color: "#15803D", borderRadius: 999, padding: "1px 7px" }}>portal · accepted</span>
            )}
          </div>
          {contact.email ? (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.email}</div>
          ) : canManage && !open ? (
            <button
              onClick={() => setOpen(true)}
              className="mono"
              style={{ border: "1px dashed #FADCB4", background: "#FFF7ED", color: "#B45309", fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: "2px 8px", cursor: "pointer", marginTop: 2 }}
            >
              ⚠ add email
            </button>
          ) : (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted-line)" }}>no email</div>
          )}
        </div>
        {canManage && !open && (
          <button onClick={() => setOpen(true)} style={{ border: 0, background: "none", color: missing ? "#B45309" : "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer", flex: "none" }}>
            {missing ? "⚠ " : ""}Edit
          </button>
        )}
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <input style={inputStyle} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input style={inputStyle} placeholder="Email" inputMode="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input style={inputStyle} placeholder="Phone" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={save} disabled={busy} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} style={{ background: "none", color: "var(--muted)", border: 0, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
            {error && <span style={{ color: "#b00020", fontSize: 11.5 }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountContactsCard({ orgId, accountName, contacts, canManage }: { orgId: string; accountName: string; contacts: RailContact[]; canManage: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", title: "" });

  async function add() {
    setBusy(true);
    setError(null);
    const r = await post("/api/contacts", { name: form.name, email: form.email || undefined, organizationId: orgId, skipTriage: true });
    if (!r.ok) setError(r.message ?? "Failed.");
    else {
      setAdding(false);
      setForm({ name: "", email: "", title: "" });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="kicker">Contacts</span>
        {canManage && (
          <>
            <button onClick={() => setInviting(true)} style={{ marginLeft: "auto", border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              invite
            </button>
            <button onClick={() => setAdding((v) => !v)} style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {adding ? "cancel" : "+ add"}
            </button>
          </>
        )}
      </div>
      {inviting && <PortalInviteModal orgId={orgId} accountName={accountName} onClose={() => setInviting(false)} />}
      {adding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0 4px" }}>
          <input style={inputStyle} placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input style={inputStyle} placeholder="Email (optional)" inputMode="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <button onClick={add} disabled={busy || !form.name.trim()} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
            {busy ? "Adding…" : "Add contact"}
          </button>
          {error && <span style={{ color: "#b00020", fontSize: 11.5 }}>{error}</span>}
        </div>
      )}
      <div style={{ marginTop: 4 }}>
        {contacts.length === 0 ? (
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted-line)" }}>No contacts yet.</p>
        ) : (
          contacts.map((c) => <ContactRow key={c.id} contact={c} canManage={canManage} />)
        )}
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 10 }}>
        edits apply everywhere — board, deals &amp; projects
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- + New deal

export function NewDealButton({
  orgId,
  contacts,
  origin,
  originProjectId,
  label = "+ New deal",
}: {
  orgId: string;
  contacts: { id: string; name: string }[];
  origin?: "captured" | "spawned_from_project";
  originProjectId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", value: "", contactId: contacts[0]?.id ?? "" });

  async function create() {
    setBusy(true);
    setError(null);
    const r = await post(`/api/accounts/${orgId}/deals`, {
      name: form.name,
      valueCents: form.value ? Math.round(parseFloat(form.value) * 100) : undefined,
      contactId: form.contactId || undefined,
      origin,
      originProjectId,
    });
    if (!r.ok) setError(r.message ?? "Failed.");
    else {
      setOpen(false);
      if (r.dealId) router.push(`/dashboard/sales/deals/${r.dealId}`);
      else router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: "none" }}
      >
        {label}
      </button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ background: "var(--white)", borderRadius: 16, boxShadow: "var(--shadow-modal)", width: "100%", maxWidth: 420, padding: "20px 22px" }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>New deal</h3>
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 3 }}>
              {origin === "spawned_from_project" ? "spawned from project closeout — opens in Discovery" : "opens in Discovery on this account"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <input style={inputStyle} placeholder="Deal name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
              <input className="mono" style={inputStyle} placeholder="Est. value $ (gut call)" inputMode="numeric" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") }))} />
              {contacts.length > 0 && (
                <select style={inputStyle} value={form.contactId} onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}>
                  <option value="">No contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "10px 0 0" }}>{error}</p>}
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setOpen(false)} style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={create} disabled={busy || !form.name.trim()} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {busy ? "Creating…" : "Create deal →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
