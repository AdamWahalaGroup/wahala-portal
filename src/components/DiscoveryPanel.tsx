"use client";

/**
 * Long-form discovery memo. AI updates arrive through the recorded-call evidence
 * review; staff may still correct the accepted memo directly.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MarkdownPanel } from "@/components/MarkdownPanel";

export function DiscoveryPanel({
  dealId,
  discoveryMd,
  canManage,
}: {
  dealId: string;
  discoveryMd: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (!canManage && !discoveryMd) return null;

  const preview = discoveryMd
    ? discoveryMd.replace(/[#>*_`~\[\]()]/g, " ").replace(/\s+/g, " ").trim()
    : "No accepted discovery memo yet.";

  async function saveEdits(next: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ discoveryMd: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        return data.message ?? `Failed (${res.status}).`;
      }
      router.refresh();
      return null;
    } catch {
      return "Network error — please try again.";
    }
  }

  return (
    <section style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, border: 0, background: "none", padding: 0, color: "inherit", cursor: "pointer", textAlign: "left" }}
      >
        <span className="kicker" style={{ color: "#303642", fontSize: 10.5, fontWeight: 900, letterSpacing: ".09em" }}>Discovery memo</span>
        <span className="mono" style={{ marginLeft: "auto", color: "var(--cobalt-text)", fontSize: 10, fontWeight: 800 }}>
          {expanded ? "collapse ↑" : "expand ↓"}
        </span>
      </button>

      {!expanded ? (
        <p style={{ margin: "8px 0 0", color: discoveryMd ? "var(--ink-soft)" : "var(--muted-line)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {preview}
        </p>
      ) : (
        <div style={{ marginTop: 10 }}>
          <MarkdownPanel
            value={discoveryMd ?? ""}
            editable={canManage}
            onSave={saveEdits}
            placeholder="No accepted discovery memo yet — analyze a call above, review the evidence, or Edit to write it by hand."
            minHeight={150}
            maxHeight={360}
          />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            Accepted evidence updates this memo; wins carry it into the client&apos;s AI memory automatically. The editor can be resized vertically.
          </p>
        </div>
      )}
    </section>
  );
}
