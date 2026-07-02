"use client";

/**
 * Editable contact block for the deal drawer Overview (frame 29). The contact is a
 * SHARED record, so qualifying a lead never freezes its fields — you can add a missing
 * email straight from the deal. A missing required field shows as an amber dashed chip
 * that is itself the edit trigger ("⚠ add email"). Saves PATCH the contact and refresh,
 * so the change lands on every surface that references it.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 13,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ContactBlock({
  contactId,
  name,
  orgName,
  email,
  phone,
  canManage,
}: {
  contactId: string;
  name: string;
  orgName: string;
  email: string | null;
  phone: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name, email: email ?? "", phone: phone ?? "" });

  function edit(focus?: "email" | "phone") {
    setForm({ name, email: email ?? "", phone: phone ?? "" });
    setError(null);
    setOpen(true);
    if (focus) queueMicrotask(() => document.getElementById(`contact-${focus}`)?.focus());
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const missingChip = (label: string, focus: "email" | "phone") => (
    <button
      onClick={() => canManage && edit(focus)}
      disabled={!canManage}
      className="kicker"
      style={{
        fontSize: 9.5,
        padding: "3px 9px",
        borderRadius: 999,
        color: "#B45309",
        background: "#FFF7ED",
        border: "1px dashed #FADCB4",
        cursor: canManage ? "pointer" : "default",
      }}
    >
      ⚠ {label}
    </button>
  );

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span className="kicker">Contact</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>edits apply everywhere — lead, deal &amp; client</span>
      </div>

      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{ width: 34, height: 34, borderRadius: 999, background: "#F1F2F4", color: "var(--ink-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12.5, flex: "none" }}
          >
            {initials(name)}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>{name}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{orgName}</div>
          </div>
          {canManage && !open && (
            <button onClick={() => edit()} style={{ border: "none", background: "transparent", color: "var(--cobalt-text)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flex: "none" }}>
              Edit
            </button>
          )}
        </div>

        {!open && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {email ? (
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{email}</span>
            ) : (
              missingChip("add email", "email")
            )}
            {(email || phone) && phone && <span style={{ color: "var(--muted-line)" }}>·</span>}
            {phone ? (
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{phone}</span>
            ) : (
              missingChip("add phone", "phone")
            )}
          </div>
        )}

        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <input style={inputStyle} placeholder="Name" value={form.name} onChange={set("name")} />
            <input id="contact-email" style={inputStyle} placeholder="Email" inputMode="email" value={form.email} onChange={set("email")} />
            <input id="contact-phone" style={inputStyle} placeholder="Phone" inputMode="tel" value={form.phone} onChange={set("phone")} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={save} disabled={busy} style={{ background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} style={{ background: "var(--white)", color: "var(--ink-soft)", border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              {error && <span style={{ color: "#b00020", fontSize: 12.5 }}>{error}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
