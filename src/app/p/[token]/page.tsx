/**
 * PUBLIC proposal page — what the prospect opens from the share link. No login;
 * the unguessable token is the credential. Option A / Option B side by side, prices
 * included (set by a human), online approval with a typed name. Draft/superseded
 * proposals 404.
 */
import { notFound } from "next/navigation";
import { getProposalByToken } from "@/services/proposals";
import { Brand } from "@/components/Brand";
import { Money } from "@/components/Money";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { PublicApprove } from "@/components/PublicApprove";

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await getProposalByToken(token);
  if (!p) notFound();

  const selected = p.selectedOptionId ? p.options.find((o) => o.id === p.selectedOptionId) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-soft)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Brand size={22} />
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Proposal v{p.version} · prepared for {p.organizationName}
            {p.sentAt ? ` · ${new Date(p.sentAt).toLocaleDateString()}` : ""}
          </span>
        </div>

        <h1 style={{ margin: "28px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>{p.title}</h1>

        {p.status === "approved" && (
          <div style={{ marginTop: 16, background: "#e8f7ee", border: "1px solid #bfe8cf", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#15803d", fontWeight: 600 }}>
            ✓ Approved{p.respondedByName ? ` by ${p.respondedByName}` : ""}
            {selected ? ` — Option ${selected.label}: ${selected.name}` : ""}
          </div>
        )}
        {p.status === "declined" && (
          <div style={{ marginTop: 16, background: "#fdeeee", border: "1px solid #f0caca", borderRadius: 12, padding: "12px 16px", fontSize: 14, color: "#b91c1c", fontWeight: 600 }}>
            This proposal was declined. Your Wahala representative can prepare a revised version.
          </div>
        )}

        {p.executiveSummaryMd && (
          <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 28px" }}>
            <SimpleMarkdown md={p.executiveSummaryMd} size={14.5} />
          </section>
        )}

        {/* Options side by side */}
        <section style={{ marginTop: 24 }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Two ways to do this</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {p.options.map((o) => {
              const isSelected = p.selectedOptionId === o.id;
              return (
                <div
                  key={o.id}
                  style={{
                    background: "var(--white)",
                    border: isSelected ? "2px solid #16a34a" : "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "22px 24px",
                  }}
                >
                  <div className="kicker" style={{ color: "var(--muted)" }}>Option {o.label}{isSelected ? " · chosen" : ""}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.015em", marginTop: 4 }}>{o.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 4px" }}>
                    <Money cents={o.priceCents} style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }} />
                    {o.priceNote && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{o.priceNote}</span>}
                  </div>
                  {o.timelineNote && (
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{o.timelineNote}</div>
                  )}
                  <SimpleMarkdown md={o.summaryMd} size={13.5} />
                </div>
              );
            })}
          </div>
        </section>

        {p.assumptionsMd && (
          <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px 24px" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Assumptions</div>
            <SimpleMarkdown md={p.assumptionsMd} size={13.5} />
          </section>
        )}

        {p.status === "sent" && (
          <section style={{ marginTop: 24 }}>
            <PublicApprove token={token} options={p.options.map((o) => ({ id: o.id, label: o.label, name: o.name }))} />
          </section>
        )}

        <p style={{ margin: "28px 0 0", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
          Questions? Reply to your Wahala Group contact — we&apos;d rather answer than assume.
        </p>
      </div>
    </div>
  );
}
