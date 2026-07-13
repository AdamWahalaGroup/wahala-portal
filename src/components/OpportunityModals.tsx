"use client";

/**
 * The two entry points of the opportunities restructure (HANDOFF-DELTA-2026-07-09 §3),
 * replacing the Capture-contact modal:
 *
 *  · NewOpportunityModal — a deal at stage 'new' on a contact (picked or created
 *    inline), account optional, "What do they need" seeds the name + discovery note.
 *  · NewContactModal — a deliberate person(+company) record with NO opportunity;
 *    no auto-invite — create lands on the contact page, where Portal access is
 *    the emphasized next step.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type AccountOption = { id: string; name: string; state: string };
type ContactOption = { id: string; name: string; email: string | null; organizationId: string | null; organizationName: string | null };

const SOURCES = ["Referral", "Website form", "Event", "Cold outreach", "Existing account", "Reddit / social", "Other"];

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 9,
  padding: "9px 11px",
  fontSize: 13.5,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "#9aa0aa", margin: "12px 0 5px", fontWeight: 600 };

const stateLabel = (s: string) => (s === "active" ? "client" : s === "archived" ? "past client" : "prospect");

export function ModalShell({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "7vh 20px 20px", overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, padding: "22px 24px 24px", maxWidth: 480, width: "100%", boxShadow: "var(--shadow-modal)" }}>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#9aa0aa" }}>{kicker}</div>
        <h3 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Account combobox — typeahead over existing accounts + inline "+ create new" + none. */
function AccountPicker({
  accounts,
  picked,
  createNew,
  query,
  onPick,
  onCreateNew,
  onQuery,
  onClear,
}: {
  accounts: AccountOption[];
  picked: AccountOption | null;
  createNew: boolean;
  query: string;
  onPick: (a: AccountOption) => void;
  onCreateNew: () => void;
  onQuery: (q: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : accounts).slice(0, 6);
  }, [query, accounts]);

  if (picked || (createNew && query.trim())) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #d7d9df", borderRadius: 9, padding: "8px 11px", background: "var(--surface)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {picked ? picked.name : query.trim()}
        </span>
        <span className="mono" style={{ fontSize: 9.5, color: picked ? "var(--muted)" : "#15803D", flex: "none" }}>
          {picked ? picked.state : "new account"}
        </span>
        <button onClick={onClear} style={{ border: 0, background: "none", color: "#C4C8CF", cursor: "pointer", fontSize: 14, padding: 0, flex: "none" }}>×</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => {
          onQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search accounts — or leave empty (none yet)"
        style={inputStyle}
      />
      {open && (query.trim() || matches.length > 0) && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, background: "var(--white)", border: "1px solid #E2E3E8", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.1)", marginTop: 4, overflow: "hidden" }}>
          {matches.map((a) => (
            <button
              key={a.id}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(a);
                setOpen(false);
              }}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, border: 0, background: "none", padding: "8px 11px", fontSize: 13, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", flex: "none" }}>{a.state}</span>
            </button>
          ))}
          {query.trim() && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onCreateNew();
                setOpen(false);
              }}
              style={{ display: "block", width: "100%", border: 0, borderTop: matches.length ? "1px solid #F1F2F4" : 0, background: "none", padding: "8px 11px", fontSize: 13, fontWeight: 700, color: "#15803D", cursor: "pointer", textAlign: "left" }}
            >
              + create “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- New opportunity

export function NewOpportunityModal({
  currentUserId,
  lockedContact,
  onClose,
}: {
  currentUserId?: string;
  /** Launched from a contact page — the contact is fixed. */
  lockedContact?: { id: string; name: string; organizationId: string | null; organizationName: string | null };
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTypedRecords, setConfirmTypedRecords] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);

  // Contact: picked existing / created inline.
  const [contactQuery, setContactQuery] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [pickedContact, setPickedContact] = useState<ContactOption | null>(
    lockedContact ? { id: lockedContact.id, name: lockedContact.name, email: null, organizationId: lockedContact.organizationId, organizationName: lockedContact.organizationName } : null,
  );
  const [newContact, setNewContact] = useState(false);
  const [contactEmail, setContactEmail] = useState("");

  // Account: existing / new / none.
  const [accountQuery, setAccountQuery] = useState("");
  const [pickedAccount, setPickedAccount] = useState<AccountOption | null>(null);
  const [createAccount, setCreateAccount] = useState(false);

  const [need, setNeed] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(currentUserId ?? "");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((raw) => {
        const d = raw as { clients?: { org: { id: string; name: string; status: string } }[] };
        setAccounts((d.clients ?? []).map((c) => ({ id: c.org.id, name: c.org.name, state: stateLabel(c.org.status) })));
      })
      .catch(() => setAccounts([]));
    if (!lockedContact) {
      fetch("/api/contacts")
        .then((r) => (r.ok ? r.json() : { contacts: [] }))
        .then((d) => setContacts((d as { contacts?: ContactOption[] }).contacts ?? []))
        .catch(() => setContacts([]));
    }
    fetch("/api/staff")
      .then((r) => (r.ok ? r.json() : { staff: [] }))
      .then((d) => setStaff((d as { staff?: { id: string; name: string }[] }).staff ?? []))
      .catch(() => setStaff([]));
  }, [lockedContact]);

  const contactMatches = useMemo(() => {
    const q = contactQuery.trim().toLowerCase();
    return (q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts).slice(0, 6);
  }, [contactQuery, contacts]);

  // Picking a contact with an account pre-fills the account (never overrides a choice).
  function pickContact(c: ContactOption) {
    setPickedContact(c);
    setNewContact(false);
    if (c.organizationId && !pickedAccount && !createAccount) {
      setPickedAccount({ id: c.organizationId, name: c.organizationName ?? "Account", state: "prospect" });
    }
  }

  const typedContactName = contactQuery.trim();
  const typedAccountName = accountQuery.trim();
  const hasUnselectedContact = !pickedContact && !newContact && !!typedContactName;
  const hasUnselectedAccount = !pickedAccount && !createAccount && !!typedAccountName;
  const unselectedRecordCount = Number(hasUnselectedContact) + Number(hasUnselectedAccount);
  const canCreate = !!(pickedContact || typedContactName);

  async function submit(confirmUnselectedText = false) {
    if (!confirmUnselectedText && (hasUnselectedContact || hasUnselectedAccount)) {
      setConfirmTypedRecords(true);
      return;
    }
    setConfirmTypedRecords(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactId: pickedContact?.id,
          contactName: !pickedContact && (newContact || confirmUnselectedText) ? typedContactName : undefined,
          contactEmail: !pickedContact && (newContact || confirmUnselectedText) && contactEmail.trim() ? contactEmail.trim() : undefined,
          organizationId: pickedAccount?.id,
          newAccountName: !pickedAccount && (createAccount || confirmUnselectedText) && typedAccountName ? typedAccountName : undefined,
          need: need.trim() || undefined,
          estValueCents: value ? Math.round(parseFloat(value.replace(/[^0-9.]/g, "")) * 100) : undefined,
          source: source || undefined,
          ownerUserId: ownerUserId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      onClose();
      router.push("/dashboard/sales", { scroll: false });
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New opportunity" kicker="◔ a possible sale on a contact" onClose={onClose}>
      {confirmTypedRecords && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-typed-records-title"
          onClick={() => setConfirmTypedRecords(false)}
          style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(16,18,21,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 390, background: "var(--white)", borderRadius: 14, padding: "19px 20px", boxShadow: "var(--shadow-modal)" }}>
            <div className="kicker" id="confirm-typed-records-title">Create typed records?</div>
            <p style={{ margin: "7px 0 10px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              You typed the following {unselectedRecordCount > 1 ? "names" : "name"} but did not choose a search result. Continue to create {unselectedRecordCount > 1 ? "them" : "it"} with this opportunity.
            </p>
            <div style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 9, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
              {!pickedContact && !newContact && typedContactName && <span style={{ fontSize: 12.5 }}><b>New contact:</b> {typedContactName}</span>}
              {!pickedAccount && !createAccount && typedAccountName && <span style={{ fontSize: 12.5 }}><b>New account:</b> {typedAccountName}</span>}
            </div>
            <p className="mono" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--muted-line)" }}>If either already exists, go back and select it to avoid a duplicate.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button onClick={() => setConfirmTypedRecords(false)} style={{ background: "var(--white)", border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Go back</button>
              <button onClick={() => void submit(true)} disabled={busy} style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{busy ? "Creating…" : "Create and continue"}</button>
            </div>
          </div>
        </div>
      )}
      <label style={labelStyle}>Contact</label>
      {pickedContact ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #d7d9df", borderRadius: 9, padding: "8px 11px", background: "var(--surface)" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{pickedContact.name}</span>
          {pickedContact.organizationName && <span className="mono" style={{ fontSize: 9.5, color: "var(--muted)" }}>{pickedContact.organizationName}</span>}
          {!lockedContact && (
            <button onClick={() => setPickedContact(null)} style={{ border: 0, background: "none", color: "#C4C8CF", cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            ref={firstRef}
            value={contactQuery}
            onChange={(e) => {
              setContactQuery(e.target.value);
              setContactOpen(true);
              setNewContact(false);
            }}
            onFocus={() => setContactOpen(true)}
            onBlur={() => setTimeout(() => setContactOpen(false), 150)}
            placeholder="Search contacts — or type a new name"
            style={inputStyle}
          />
          {contactOpen && contactQuery.trim() && !newContact && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 6, background: "var(--white)", border: "1px solid #E2E3E8", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.1)", marginTop: 4, overflow: "hidden" }}>
              {contactMatches.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickContact(c);
                  }}
                  style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, border: 0, background: "none", padding: "8px 11px", fontSize: 13, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", flex: "none" }}>{c.organizationName ?? "no account"}</span>
                </button>
              ))}
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setNewContact(true);
                  setContactOpen(false);
                }}
                style={{ display: "block", width: "100%", border: 0, borderTop: contactMatches.length ? "1px solid #F1F2F4" : 0, background: "none", padding: "8px 11px", fontSize: 13, fontWeight: 700, color: "#15803D", cursor: "pointer", textAlign: "left" }}
              >
                + new contact “{contactQuery.trim()}”
              </button>
            </div>
          )}
        </div>
      )}
      {hasUnselectedContact && !contactOpen && (
        <p className="mono" style={{ margin: "5px 0 0", fontSize: 9.5, color: "#B45309" }}>Not selected · creation will be confirmed when you submit.</p>
      )}
      {newContact && !pickedContact && (
        <>
          <label style={labelStyle}>Email <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional</span></label>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="them@company.com" style={inputStyle} />
        </>
      )}

      <label style={labelStyle}>Account <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional — born at Create project if missing</span></label>
      <AccountPicker
        accounts={accounts}
        picked={pickedAccount}
        createNew={createAccount}
        query={accountQuery}
        onPick={(a) => {
          setPickedAccount(a);
          setCreateAccount(false);
        }}
        onCreateNew={() => setCreateAccount(true)}
        onQuery={setAccountQuery}
        onClear={() => {
          setPickedAccount(null);
          setCreateAccount(false);
          setAccountQuery("");
        }}
      />
      {hasUnselectedAccount && (
        <p className="mono" style={{ margin: "5px 0 0", fontSize: 9.5, color: "#B45309" }}>Typed account · creation will be confirmed when you submit.</p>
      )}

      <label style={labelStyle}>What do they need</label>
      <textarea
        value={need}
        onChange={(e) => setNeed(e.target.value)}
        rows={2}
        placeholder="One or two sentences — this names the opportunity and grounds the proposal later."
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Est. value <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>gut call is fine</span></label>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="$ 25,000" inputMode="numeric" className="mono" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Owner</label>
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} style={inputStyle}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <label style={labelStyle}>Source</label>
      <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
        <option value="">—</option>
        {SOURCES.map((s) => (
          <option key={s} value={s.toLowerCase()}>{s}</option>
        ))}
      </select>

      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} disabled={busy} style={{ background: "var(--white)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy || !canCreate}
          style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: busy || !canCreate ? "default" : "pointer", opacity: busy || !canCreate ? 0.55 : 1 }}
        >
          {busy ? "Creating…" : "Create opportunity →"}
        </button>
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 10 }}>
        lands in New with the ◔ badge — accept it to start the deal
      </div>
    </ModalShell>
  );
}

/** "+ New contact" for the Contacts page (server component) — button + modal. */
export function NewContactButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}
      >
        + New contact
      </button>
      {open && <NewContactModal onClose={() => setOpen(false)} />}
    </>
  );
}

/** "+ Start opportunity" from a contact page — opens the modal with the contact fixed. */
export function StartOpportunityButton({
  contact,
  currentUserId,
}: {
  contact: { id: string; name: string; organizationId: string | null; organizationName: string | null };
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}
      >
        + Start opportunity
      </button>
      {open && <NewOpportunityModal currentUserId={currentUserId} lockedContact={contact} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- New contact + account

export function NewContactModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", title: "", notes: "" });
  const [accountQuery, setAccountQuery] = useState("");
  const [pickedAccount, setPickedAccount] = useState<AccountOption | null>(null);
  const [createAccount, setCreateAccount] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((raw) => {
        const d = raw as { clients?: { org: { id: string; name: string; status: string } }[] };
        setAccounts((d.clients ?? []).map((c) => ({ id: c.org.id, name: c.org.name, state: stateLabel(c.org.status) })));
      })
      .catch(() => setAccounts([]));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          title: form.title.trim() || undefined,
          notes: form.notes.trim() || undefined,
          organizationId: pickedAccount?.id,
          newAccountName: !pickedAccount && createAccount && accountQuery.trim() ? accountQuery.trim() : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; contactId?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        setBusy(false);
        return;
      }
      // Creation never ends on a surface where the record can't be seen
      // (HANDOFF-FIX-2026-07-09 §3) — land on the new contact's own page,
      // where Portal access is the emphasized next step.
      onClose();
      router.push(data.contactId ? `/dashboard/contacts/${data.contactId}` : "/dashboard/contacts");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New contact + account" kicker="people first — no opportunity yet" onClose={onClose}>
      <label style={labelStyle}>Name</label>
      <input ref={nameRef} value={form.name} onChange={set("name")} placeholder="Full name" style={inputStyle} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input value={form.email} onChange={set("email")} placeholder="them@company.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input value={form.phone} onChange={set("phone")} placeholder="+1 …" style={inputStyle} />
        </div>
      </div>
      <label style={labelStyle}>Title <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional</span></label>
      <input value={form.title} onChange={set("title")} placeholder="Ops director…" style={inputStyle} />

      <label style={labelStyle}>Account</label>
      <AccountPicker
        accounts={accounts}
        picked={pickedAccount}
        createNew={createAccount}
        query={accountQuery}
        onPick={(a) => {
          setPickedAccount(a);
          setCreateAccount(false);
        }}
        onCreateNew={() => setCreateAccount(true)}
        onQuery={setAccountQuery}
        onClear={() => {
          setPickedAccount(null);
          setCreateAccount(false);
          setAccountQuery("");
        }}
      />

      <label style={labelStyle}>Notes <span style={{ textTransform: "none", fontWeight: 500, color: "#b4b9c1" }}>optional</span></label>
      <textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Anything worth remembering" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

      {/* No auto-invite (founder call, 09 Jul) — the invite is the next step, on the contact page. */}
      <div style={{ marginTop: 14, padding: "11px 14px", background: "#fafbff", border: "1px solid #dde1fb", borderRadius: 11, fontSize: 12.5, color: "#2536c4", lineHeight: 1.5 }}>
        ✉ No invitation goes out yet — you&rsquo;ll land on the contact&rsquo;s page, where sending the portal invite is the suggested next step.
      </div>

      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "12px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} disabled={busy} style={{ background: "var(--white)", border: "1px solid #d7d9df", borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !form.name.trim()}
          style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: busy || !form.name.trim() ? "default" : "pointer", opacity: busy || !form.name.trim() ? 0.55 : 1 }}
        >
          {busy ? "Creating…" : "Create contact"}
        </button>
      </div>
    </ModalShell>
  );
}
