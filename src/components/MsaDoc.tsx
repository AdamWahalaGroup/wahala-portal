"use client";

/**
 * A rendered account-level document (MSA or NDA) — boilerplate merged with
 * live account data, print-ready. The signed source of truth is the executed
 * copy (DocuSign round pending); this is the document you SEND. Status banner
 * mirrors the agreement row (needed / sent / signed / none seeded yet).
 */
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

type Banner = { bg: string; border: string; color: string; label: string };

const SHARED: Record<string, Omit<Banner, "label">> = {
  none: { bg: "#F1F2F4", border: "#E2E3E8", color: "#4B5159" },
  needed: { bg: "#FAFBFF", border: "#C9D0FB", color: "#2536C4" },
  sent: { bg: "#FFF7ED", border: "#FADCB4", color: "#B45309" },
  signed: { bg: "#DCF5E3", border: "#BFE6CC", color: "#15803D" },
};

export type DocKind = "msa" | "nda" | "commercial_agreement" | "professional_services";

const LABELS: Record<DocKind, { kicker: string; byStatus: Record<string, string> }> = {
  msa: {
    kicker: "Wahala Group · Master Services Agreement",
    byStatus: {
      none: "Not in a deal package yet — this is the boilerplate preview. The MSA row seeds when a deal reaches Committed.",
      needed: "Needed — send this for signature, then mark it sent on the deal's agreement package.",
      sent: "Sent — waiting on signature.",
      signed: "Signed — on file account-wide; every later deal rides on it (SOW only).",
    },
  },
  nda: {
    kicker: "Wahala Group · Mutual Non-Disclosure Agreement",
    byStatus: {
      none: "Not in a deal package yet — this is the boilerplate preview. The NDA row seeds when a deal reaches Committed.",
      needed: "Needed — send this for signature, then mark it sent on the deal's agreement package.",
      sent: "Sent — waiting on signature.",
      signed: "Signed — on file account-wide; discovery conversations are covered.",
    },
  },
  commercial_agreement: {
    kicker: "Wahala Group · Commercial Agreement",
    byStatus: {
      none: "Not in a deal package yet — this is the boilerplate preview. The row seeds when a deal reaches Committed.",
      needed: "Needed — send this for signature, then mark it sent on the deal's agreement package.",
      sent: "Sent — waiting on signature.",
      signed: "Signed — standing pricing & payment terms; SOWs only state what differs.",
    },
  },
  professional_services: {
    kicker: "Wahala Group · Professional Services Terms",
    byStatus: {
      none: "Not in a deal package yet — this is the boilerplate preview. The row seeds when a deal reaches Committed.",
      needed: "Needed — send this for signature, then mark it sent on the deal's agreement package.",
      sent: "Sent — waiting on signature.",
      signed: "Signed — standing delivery rules (acceptance, change orders, warranty); SOWs ride on them.",
    },
  },
};

export function MsaDoc({
  md,
  status,
  signedNote,
  templateVersion,
  kind = "msa",
}: {
  md: string;
  status: "none" | "needed" | "sent" | "signed";
  signedNote?: string | null;
  templateVersion: string;
  kind?: DocKind;
}) {
  const b: Banner = { ...SHARED[status], label: LABELS[kind].byStatus[status] };
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
        <div className="kicker" style={{ fontSize: 10 }}>{LABELS[kind].kicker}</div>
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
