"use client";

/**
 * Closeout → next deal (frame 37) — shown once to staff when a project's final
 * stage is accepted. Green closeout strip, prefilled deal name + value, the MSA
 * fast-lane chip when it applies. "Start deal → Discovery" opens a deal with
 * origin = spawned_from_project (the ↺ loop moment on the account timeline);
 * "Not now" dismisses (logged) and never comes back.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

const fmt$ = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

export function CloseoutPrompt({
  projectId,
  orgId,
  accountName,
  projectName,
  acceptedAt,
  collectedCents,
  msaOnFile,
  prefillName,
  prefillValueCents,
  contacts,
}: {
  projectId: string;
  orgId: string;
  accountName: string;
  projectName: string;
  acceptedAt: string;
  collectedCents: number;
  msaOnFile: boolean;
  prefillName: string;
  prefillValueCents: number;
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(prefillName);
  const [value, setValue] = useState(prefillValueCents > 0 ? String(Math.round(prefillValueCents / 100)) : "");
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");

  async function startDeal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${orgId}/deals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          valueCents: value ? Math.round(parseFloat(value) * 100) : undefined,
          contactId: contactId || undefined,
          origin: "spawned_from_project",
          originProjectId: projectId,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { message?: string; dealId?: string };
      if (!res.ok) setError(d.message ?? `Failed (${res.status}).`);
      else if (d.dealId) router.push(`/dashboard/sales/deals/${d.dealId}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setHidden(true);
    try {
      await fetch(`/api/projects/${projectId}/closeout`, { method: "POST" });
      router.refresh();
    } catch {
      // Hidden locally either way; the audit row just won't exist until retry.
    }
  }

  if (hidden) return null;

  return (
    <section style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 14, padding: "16px 18px", marginTop: 20 }}>
      {/* Closeout strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#DCF5E3", border: "1px solid #BFE6CC", borderRadius: 10, padding: "9px 13px" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16A34A", flex: "none" }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#15803D", flex: 1, minWidth: 0 }}>
          {projectName} — closed out
        </span>
        <span className="mono" style={{ fontSize: 10, color: "#15803D", flex: "none" }}>
          accepted {new Date(acceptedAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
          {collectedCents > 0 ? ` · ${fmt$(collectedCents)} collected` : ""}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.015em" }}>
          Propose the next deal on {accountName}?
        </h3>
        {msaOnFile && (
          <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, background: "var(--cobalt-wash)", color: "#2536C4", border: "1px solid #DDE1FB", borderRadius: 999, padding: "3px 10px", flex: "none" }}>
            MSA on file · skips legal → SOW
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <input
          style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 10px", fontSize: 13, flex: "2 1 220px", background: "var(--white)" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deal name"
        />
        <input
          className="mono"
          style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 10px", fontSize: 13, flex: "1 1 110px", background: "var(--white)" }}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Est. value $"
        />
        {contacts.length > 0 && (
          <select
            style={{ border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 10px", fontSize: 13, flex: "1 1 140px", background: "var(--white)" }}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">No contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={startDeal}
          disabled={busy || !name.trim()}
          style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}
        >
          {busy ? "Opening…" : "Start deal → Discovery"}
        </button>
        <button
          onClick={dismiss}
          disabled={busy}
          style={{ background: "none", color: "var(--muted)", border: 0, fontSize: 12.5, fontWeight: 600, cursor: "pointer", flex: "none" }}
        >
          Not now
        </button>
      </div>
      <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)", marginTop: 8 }}>
        opens in Discovery · origin logged as spawned-from-project · ↺ appears on the account timeline
      </div>
      {error && <p style={{ color: "#b00020", fontSize: 12.5, margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}
