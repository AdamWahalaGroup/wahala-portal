"use client";

/**
 * Long-form discovery memo. AI updates arrive through the recorded-call evidence
 * review; staff may still correct the accepted memo directly.
 */
import { useRouter } from "next/navigation";
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

  if (!canManage && !discoveryMd) return null;

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
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <div className="kicker">Discovery memo</div>
      </div>

      <MarkdownPanel
        value={discoveryMd ?? ""}
        editable={canManage}
        onSave={saveEdits}
        placeholder="No accepted discovery memo yet — analyze a call above, review the evidence, or Edit to write it by hand."
        maxHeight={560}
      />
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Accepted evidence updates this memo; wins carry it into the client&apos;s AI memory automatically.
      </p>
    </section>
  );
}
