"use client";

/**
 * Agreement package + deal→project handoff (frame 34) — the Committed-stage body.
 * One row per agreement (account-level MSA/NDA + this deal's docs) plus the deposit
 * invoice as the blocking row. "When the deposit clears" card carries the explicit
 * Create project → action (disabled until the deposit is paid; admins may force).
 * Statuses nudge, never gate — an incomplete package warns, it doesn't block.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PortalInviteModal } from "@/components/PortalInviteModal";

type AgreementRow = {
  id: string;
  kind: string;
  label: string;
  status: "needed" | "sent" | "signed" | "n_a";
  signedAt: string | Date | null;
  note: string | null;
  accountLevel: boolean;
};

export type Room = {
  available: boolean;
  agreements: AgreementRow[];
  msaOnFile: boolean;
  deposit: { cents: number; sentAt: string | Date | null; paidAt: string | Date | null };
  approvedProposal: { id: string; title: string; optionLabel: string | null; optionName: string | null; priceCents: number | null; timelineNote: string | null } | null;
  clientInvited: boolean;
  contactEmail: string | null;
  contactName: string | null;
  project: { id: string; name: string } | null;
  phases: { name: string; amountCents: number; weeks: number | null }[];
};

const btn = (tone: "ink" | "green" | "plain", disabled: boolean): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

const fmt$ = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });

export function ContractRoom({
  dealId,
  orgId,
  room,
  canManage,
  isAdmin,
  orgName,
}: {
  dealId: string;
  orgId: string;
  room: Room;
  canManage: boolean;
  isAdmin: boolean;
  orgName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"execute" | "force" | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  // Frame 35: the invite moment right after Create project → succeeds.
  const [invitePrompt, setInvitePrompt] = useState<{ projectId: string; projectName: string; stagesN: number; depositPaid: boolean } | null>(null);

  if (!room.available) return null;

  async function call(url: string, body: unknown, key: string, method = "POST"): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { message?: string };
      if (!res.ok) {
        setError(data.message ?? `Failed (${res.status}).`);
        return null;
      }
      return data;
    } catch {
      setError("Network error — please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function setAgreement(a: AgreementRow, next: AgreementRow["status"]) {
    const data = await call(`/api/agreements/${a.id}`, { status: next }, `ag-${a.id}`, "PATCH");
    if (data) router.refresh();
  }

  async function deposit(body: Record<string, unknown>, key: string) {
    const data = await call(`/api/deals/${dealId}/deposit`, body, key);
    if (data) router.refresh();
  }

  async function invite() {
    const data = await call(`/api/deals/${dealId}/contract/invite`, {}, "invite");
    if (data) {
      if (typeof data.inviteLink === "string") setInviteLink(data.inviteLink);
      setStatus("Invite sent ✓");
      router.refresh();
    }
  }

  async function execute(force: boolean) {
    setConfirm(null);
    const data = await call(`/api/deals/${dealId}/contract/execute`, { force }, "execute");
    if (data && typeof data.projectId === "string") {
      // The invite moment (frame 35) — then on to the project.
      setInvitePrompt({
        projectId: data.projectId,
        projectName: room.approvedProposal?.title ?? "New project",
        stagesN: typeof data.stagesCreated === "number" ? data.stagesCreated : 0,
        depositPaid: !!room.deposit.paidAt,
      });
      router.refresh();
    }
  }

  const rows = room.agreements.filter((a) => a.status !== "n_a");
  const depositSet = room.deposit.cents > 0;
  const depositPaid = !!room.deposit.paidAt;
  const total = rows.length + 1; // + the deposit row
  const done = rows.filter((a) => a.status === "signed").length + (depositPaid ? 1 : 0);
  const complete = done === total;

  /** Status pill (founder call, 10 Jul): outline while pending, fills in place when done. */
  const pillStyle = (tone: "plain" | "green" | "amber"): React.CSSProperties => ({
    border: tone === "green" ? "1px solid #BFE6CC" : tone === "amber" ? "1px solid #FADCB4" : "1px solid #D7D9DF",
    background: tone === "green" ? "#DCF5E3" : tone === "amber" ? "#FCEFDC" : "var(--white)",
    color: tone === "green" ? "#15803D" : tone === "amber" ? "#B45309" : "var(--muted)",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 11.5,
    fontWeight: 700,
    cursor: "pointer",
    flex: "none",
  });

  return (
    <section>
      {/* Agreement package */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span className="kicker">Agreement package</span>
        {room.msaOnFile && <span className="mono" style={{ fontSize: 9.5, color: "#15803D" }}>MSA on file · SOW only</span>}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: complete ? "#15803D" : "var(--muted)" }}>
          {done} / {total}
        </span>
      </div>

      <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
        {/* One row shape for every status — the checkbox stays put and the Signed
            PILL fills green in place (founder call, 10 Jul: the old green text
            link read as already-signed, and signing swapped the whole row). */}
        {rows.map((a) => {
          const signed = a.status === "signed";
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: signed ? "#FBFBFC" : "var(--white)", border: signed ? "1px solid #EEF0F2" : "1px solid #E7E8EC", borderRadius: 10, padding: "10px 12px" }}>
              {signed ? (
                <span style={{ width: 20, height: 20, borderRadius: 999, background: "#DCF5E3", color: "#15803D", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "none" }}>✓</span>
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: 999, border: "1.5px solid #D7D9DF", flex: "none" }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</div>
                <div className="mono" style={{ fontSize: 9.5, color: "var(--muted-line)" }}>
                  {signed
                    ? [a.note, a.signedAt ? `signed ${fmtDate(a.signedAt)}` : null].filter(Boolean).join(" · ") || (a.accountLevel ? "account-level — reused by every deal" : "signed")
                    : a.status === "sent"
                      ? "sent · waiting on signature"
                      : a.note ?? (a.accountLevel ? "account-level — signed once, reused" : "needed")}
                </div>
              </div>
              {/* MSA/NDA boilerplate auto-populates from the account — open, print, send. */}
              {(a.kind === "msa" || a.kind === "nda") && orgId && (
                <Link href={`/dashboard/accounts/${orgId}/${a.kind}`} style={{ fontSize: 12, fontWeight: 700, color: "var(--cobalt-text)", textDecoration: "none", flex: "none" }}>
                  View doc →
                </Link>
              )}
              {canManage && (
                <div style={{ display: "flex", gap: 8, flex: "none", alignItems: "center" }}>
                  {!signed && (
                    <button
                      onClick={() => setAgreement(a, a.status === "sent" ? "needed" : "sent")}
                      disabled={busy !== null}
                      title={a.status === "sent" ? "Sent — click to undo" : "Mark as sent"}
                      style={pillStyle(a.status === "sent" ? "amber" : "plain")}
                    >
                      {a.status === "sent" ? "✓ Sent" : "Send"}
                    </button>
                  )}
                  <button
                    onClick={() => setAgreement(a, signed ? "needed" : "signed")}
                    disabled={busy !== null}
                    title={signed ? "Signed — click to undo" : "Mark as signed"}
                    style={pillStyle(signed ? "green" : "plain")}
                  >
                    {signed ? "✓ Signed" : "Signed"}
                  </button>
                  {!signed && (
                    <button onClick={() => setAgreement(a, "n_a")} disabled={busy !== null} className="mono" title="Not applicable to this deal" style={{ border: 0, background: "none", color: "#C4C8CF", fontSize: 10, cursor: "pointer" }}>
                      n/a
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Deposit — the blocking row. Same pill treatment; one row shape for unpaid
            AND paid. Bookkeeping is one-way (no un-send/un-pay API), so filled pills
            here don't toggle back. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: depositPaid ? "#FBFBFC" : "#FFF7ED",
            border: depositPaid ? "1px solid #EEF0F2" : "1px solid #FADCB4",
            borderRadius: 10,
            padding: "10px 12px",
            flexWrap: "wrap",
          }}
        >
          {depositPaid ? (
            <span style={{ width: 20, height: 20, borderRadius: 999, background: "#DCF5E3", color: "#15803D", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "none" }}>✓</span>
          ) : (
            <span style={{ width: 20, height: 20, borderRadius: 999, background: "#FCEFDC", color: "#B45309", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flex: "none" }}>⚠</span>
          )}
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: depositPaid ? "var(--ink)" : "#B45309" }}>
              {depositPaid ? `Deposit — ${fmt$(room.deposit.cents)}` : `Deposit invoice${depositSet ? ` — ${fmt$(room.deposit.cents)}` : ""}`}
            </div>
            <div className="mono" style={{ fontSize: 9.5, color: depositPaid ? "var(--muted-line)" : "#B45309" }}>
              {depositPaid
                ? `paid ${fmtDate(room.deposit.paidAt!)}`
                : room.deposit.sentAt
                  ? `sent ${fmtDate(room.deposit.sentAt)} · waiting on client`
                  : depositSet
                    ? "not sent yet"
                    : "set the amount to start the clock"}
            </div>
          </div>
          {canManage && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none", flexWrap: "wrap" }}>
              {!depositPaid && !depositSet && (
                <>
                  <input
                    className="mono"
                    style={{ border: "1px solid #FADCB4", borderRadius: 8, padding: "6px 8px", fontSize: 12, width: 90, background: "var(--white)" }}
                    placeholder="$65,000"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                  <button
                    onClick={() => amount && deposit({ amountCents: Math.round(parseFloat(amount) * 100) }, "dep-set")}
                    disabled={busy !== null || !amount}
                    style={{ border: 0, background: "none", color: "var(--cobalt-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Set
                  </button>
                </>
              )}
              {!depositPaid && depositSet && (
                room.deposit.sentAt ? (
                  <span title={`sent ${fmtDate(room.deposit.sentAt)}`} style={{ ...pillStyle("amber"), cursor: "default" }}>✓ Sent</span>
                ) : (
                  <button onClick={() => deposit({ markSent: true }, "dep-sent")} disabled={busy !== null} title="Mark the invoice as sent" style={pillStyle("plain")}>
                    Send
                  </button>
                )
              )}
              {depositSet &&
                (depositPaid ? (
                  <span title={`paid ${fmtDate(room.deposit.paidAt!)}`} style={{ ...pillStyle("green"), cursor: "default" }}>✓ Paid</span>
                ) : (
                  <button onClick={() => deposit({ markPaid: true }, "dep-paid")} disabled={busy !== null} title="Mark the deposit as paid" style={pillStyle("plain")}>
                    Paid
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* When the deposit clears → project */}
      <div style={{ border: "1.5px solid #C9D0FB", background: "#FAFBFF", borderRadius: 12, padding: "13px 15px", marginTop: 14 }}>
        <div className="kicker" style={{ color: "var(--cobalt-text)", marginBottom: 6 }}>When the deposit clears</div>
        {room.project ? (
          <div style={{ fontSize: 13.5 }}>
            <span style={{ fontWeight: 700, color: "#15803D" }}>✓ Done — </span>
            <Link href={`/dashboard/projects/${room.project.id}`} style={{ fontWeight: 700 }}>
              {room.project.name} →
            </Link>
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}> Quote Phase 1 there; the pay-gates take it from here.</span>
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)" }}>
              This deal becomes a project on the <strong>{orgName}</strong> account.
            </p>
            {room.approvedProposal && (
              <div className="mono" style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.7 }}>
                {room.approvedProposal.optionLabel ? `Option ${room.approvedProposal.optionLabel} — ` : ""}
                {room.approvedProposal.optionName ?? room.approvedProposal.title}
                {room.approvedProposal.priceCents ? ` · ${fmt$(room.approvedProposal.priceCents)}` : ""}
                {room.approvedProposal.timelineNote ? ` · ${room.approvedProposal.timelineNote}` : ""}
              </div>
            )}
            {/* The phases the project is born with — derived from the signed option
                (or the deal itself), so this list is never empty (prototype 07-08). */}
            {room.phases.length > 0 && (
              <div style={{ display: "grid", gap: 5, marginTop: 10 }}>
                {room.phases.map((ph, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--white)", border: "1px solid #E3E7F8", borderRadius: 8, padding: "6px 10px" }}>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 800, color: "var(--cobalt-text)", flex: "none" }}>{i + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ph.name}</span>
                    <span className="mono tabular" style={{ fontSize: 11, fontWeight: 700, flex: "none" }}>
                      {fmt$(ph.amountCents)}
                      {ph.weeks ? ` · ${ph.weeks}w` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!room.approvedProposal && (
              <div className="mono" style={{ fontSize: 10, color: "#B45309", marginTop: 8 }}>
                no signed proposal — the project starts as one phase at the deal value
              </div>
            )}
            <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 6 }}>
              SOW drafts after signature — the proposal scope carries over, nothing re-typed.
              <br />
              Phase 1 opens <b>paid</b> (the deposit invoice is its payment record); later phases follow the normal pay-gate.
            </div>
            {canManage && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => setConfirm(depositPaid ? "execute" : "force")}
                  disabled={busy !== null || (!depositPaid && !isAdmin)}
                  title={
                    !depositPaid
                      ? isAdmin
                        ? "Deposit not cleared — admin force available"
                        : "Unlocks when the deposit is marked paid"
                      : undefined
                  }
                  style={btn("ink", busy !== null || (!depositPaid && !isAdmin))}
                >
                  {busy === "execute" ? "Writing SOW & creating project (~30s)…" : "Create project →"}
                </button>
                {!depositPaid && <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)" }}>{isAdmin ? "deposit pending — you can force" : "deposit pending"}</span>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Client invite */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        {room.clientInvited ? (
          <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Client has portal access</span>
        ) : canManage && room.contactEmail ? (
          <>
            <button onClick={invite} disabled={busy !== null} style={btn("plain", busy !== null)}>
              {busy === "invite" ? "Inviting…" : `Invite ${room.contactName ?? "contact"} to the portal`}
            </button>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{room.contactEmail}</span>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>No contact email on file — add one to invite the client later.</span>
        )}
        {inviteLink && <span className="mono" style={{ fontSize: 11, wordBreak: "break-all", color: "var(--muted)" }}>dev invite: {inviteLink}</span>}
      </div>

      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "10px 0 0" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}

      {invitePrompt && (
        <PortalInviteModal
          orgId={orgId}
          accountName={orgName}
          success={{ projectName: invitePrompt.projectName, stagesN: invitePrompt.stagesN, depositPaid: invitePrompt.depositPaid }}
          onClose={() => router.push(`/dashboard/projects/${invitePrompt.projectId}`)}
        />
      )}

      {confirm && (
        <div role="dialog" aria-modal="true" onClick={() => setConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(16,18,21,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 90 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--white)", borderRadius: 16, padding: 24, maxWidth: 460, width: "100%", boxShadow: "var(--shadow-modal)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 19, fontWeight: 800 }}>Create the project?</h3>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14 }}>
              The AI writes the statement of work from {room.approvedProposal ? "the approved option + discovery" : "discovery and the deal notes (no signed proposal — one phase at the deal value)"} as a real project on the {orgName} account —
              the phases keep the signed names and amounts — and the deal is marked won. You&apos;ll land on the new project to review Phase 1.
              {confirm === "force" && <strong> The deposit hasn&apos;t cleared — this is an admin override.</strong>}
              {!complete && confirm === "execute" && " Some agreements are still open — that's on you to chase."}
            </p>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setConfirm(null)} style={btn("plain", false)}>Cancel</button>
              <button onClick={() => execute(confirm === "force")} style={btn("green", false)}>
                {confirm === "force" ? "Force create →" : "Create project →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
