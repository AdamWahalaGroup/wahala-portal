"use client";

/**
 * The rendered MSA (account-level umbrella contract) — boilerplate merged with
 * live account data, print-ready. The signed source of truth is the executed
 * copy (DocuSign round pending); this is the document you SEND. Status banner
 * mirrors the agreement row (needed / sent / signed / none seeded yet).
 */
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

const BANNER: Record<string, { bg: string; border: string; color: string; label: string }> = {
  none: { bg: "#F1F2F4", border: "#E2E3E8", color: "#4B5159", label: "Not in a deal package yet — this is the boilerplate preview. The MSA row seeds when a deal reaches Committed." },
  needed: { bg: "#FAFBFF", border: "#C9D0FB", color: "#2536C4", label: "Needed — send this for signature, then mark it sent on the deal's agreement package." },
  sent: { bg: "#FFF7ED", border: "#FADCB4", color: "#B45309", label: "Sent — waiting on signature." },
  signed: { bg: "#DCF5E3", border: "#BFE6CC", color: "#15803D", label: "Signed — on file account-wide; every later deal rides on it (SOW only)." },
};

export function MsaDoc({
  md,
  status,
  signedNote,
  templateVersion,
}: {
  md: string;
  status: "none" | "needed" | "sent" | "signed";
  signedNote?: string | null;
  templateVersion: string;
}) {
  const b = BANNER[status];
  return (
    <div style={{ maxWidth: 820 }}>
      {/* Screen chrome — hidden when printing */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, background: b.bg, border: `1px solid ${b.border}`, borderRadius: 10, padding: "9px 13px", fontSize: 12.5, fontWeight: 600, color: b.color }}>
          {b.label}
          {signedNote && <span className="mono" style={{ fontWeight: 700, marginLeft: 8, fontSize: 10.5 }}>{signedNote}</span>}
        </div>
        <button
          onClick={() => window.print()}
          style={{ background: "var(--ink)", color: "var(--white)", border: 0, borderRadius: 9, padding: "9px 15px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: "none" }}
        >
          Print / save PDF
        </button>
      </div>

      {/* The paper */}
      <div className="msa-paper" style={{ background: "var(--white)", border: "1px solid #E7E8EC", borderRadius: 12, padding: "42px 48px" }}>
        <div className="kicker" style={{ fontSize: 10 }}>Wahala Group · Master Services Agreement</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--muted-line)", marginTop: 4, marginBottom: 18 }}>
          template v{templateVersion}
        </div>
        <SimpleMarkdown md={md} size={13.5} />
      </div>

      <style>{`
        @media print {
          .no-print, aside, nav { display: none !important; }
          .msa-paper { border: 0 !important; border-radius: 0 !important; padding: 0 !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
