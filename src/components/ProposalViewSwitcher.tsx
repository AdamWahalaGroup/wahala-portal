"use client";

import Link from "next/link";

const optionStyle = (active: boolean): React.CSSProperties => ({
  border: 0,
  borderRadius: 8,
  padding: "6px 12px",
  background: active ? "var(--cobalt)" : "transparent",
  color: active ? "var(--white)" : "#AEB2BB",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1,
  textDecoration: "none",
  cursor: active ? "default" : "pointer",
  whiteSpace: "nowrap",
});

export function ProposalViewSwitcher({
  mode,
  staffHref,
  onClient,
  busy = false,
}: {
  mode: "staff" | "client";
  staffHref?: string;
  onClient?: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Proposal viewing mode"
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 4,
        borderRadius: 11,
        background: "#171A22",
        boxShadow: "0 2px 8px rgba(17, 24, 39, .12)",
      }}
    >
      <span style={{ padding: "0 7px", color: "#7D828D", fontSize: 8, letterSpacing: ".08em", whiteSpace: "nowrap" }}>
        VIEWING AS
      </span>
      {mode === "staff" ? (
        <span aria-current="page" style={optionStyle(true)}>Staff</span>
      ) : (
        <Link href={staffHref ?? "/dashboard/proposals"} style={optionStyle(false)}>Staff</Link>
      )}
      {mode === "client" ? (
        <span aria-current="page" style={optionStyle(true)}>Client</span>
      ) : (
        <button type="button" onClick={onClient} disabled={busy} style={{ ...optionStyle(false), opacity: busy ? .65 : 1 }}>
          {busy ? "Saving…" : "Client"}
        </button>
      )}
    </div>
  );
}
