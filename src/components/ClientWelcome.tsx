/**
 * Client welcome / empty state (design frame 15) — what a customer lands on right
 * after accepting their invite, before any project exists.
 */
import Link from "next/link";
import { Avatar } from "@/components/People";

const OFFERINGS = [
  { title: "Build & ship", body: "Websites, services, and apps — delivered stage by stage, each one scoped, paid, and accepted before the next begins." },
  { title: "Custom AI, tuned to you", body: "Bespoke models and pipelines with minimal hallucinations that learn your business over time." },
  { title: "Hosting & maintenance", body: "We host it and keep it running, so upkeep stays on Wahala — not on you." },
  { title: "Grow on your terms", body: "A clean hand-off to your own dev team whenever you're ready to scale in-house." },
];

export function ClientWelcome({
  firstName,
  agent,
  orgId,
}: {
  firstName: string;
  agent: { name: string; email: string } | null;
  orgId: string | null;
}) {
  const agentFirst = agent?.name.split(/\s+/)[0] ?? "your Wahala agent";
  // "Message {agent}" opens the in-app account thread (the durable client↔Wahala line),
  // which exists before any project. Falls back to the Messages page if no org.
  const messageHref = orgId
    ? `/dashboard/messages?thread=${encodeURIComponent(`account:${orgId}`)}`
    : "/dashboard/messages";

  return (
    <div>
      <div className="kicker">Welcome</div>
      <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-.025em" }}>
        Welcome, {firstName}.
      </h1>

      {/* Hero */}
      <section style={{ marginTop: 22, background: "var(--ink)", color: "#cfd2da", borderRadius: 16, padding: 30, position: "relative", overflow: "hidden" }}>
        <span
          aria-hidden
          style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, background: "var(--cobalt)", opacity: 0.18, transform: "rotate(45deg)", borderRadius: 28 }}
        />
        <div className="kicker" style={{ color: "#7c8cf8" }}>Welcome to Wahala Portal</div>
        <h2 style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", color: "var(--white)", maxWidth: 560, position: "relative" }}>
          We build it, run it, and remove the wahala.
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 15, color: "#aeb2bb", maxWidth: 560, lineHeight: 1.6, position: "relative" }}>
          Wahala Group is your dedicated team for getting real work shipped. Every piece of work is a
          <strong style={{ color: "#cfd2da" }}> stage</strong> — itemized and scoped, paid up front,
          delivered by your Wahala people, and formally accepted by you before the next one begins.
          No surprises, no runaway scope.
        </p>
        {agent && (
          <p style={{ margin: "18px 0 0", fontSize: 15.5, fontWeight: 700, color: "var(--white)", maxWidth: 560, position: "relative" }}>
            Your Wahala representative is {agent.name}. {agentFirst} will contact you shortly to get
            started on your project.
          </p>
        )}
      </section>

      {/* What we do */}
      <section style={{ marginTop: 28 }}>
        <div className="kicker" style={{ marginBottom: 12 }}>What we do</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {OFFERINGS.map((o) => (
            <div key={o.title} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{o.title}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>{o.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Your Wahala agent */}
      {agent && (
        <section style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Avatar name={agent.name} variant="owner" size={42} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="kicker">Your Wahala agent</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{agent.name}</div>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--muted)" }}>
              {agentFirst} will reach out with next steps to scope your first project — or message them anytime.
            </p>
          </div>
          <Link
            href={messageHref}
            style={{ background: "var(--ink)", color: "var(--white)", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Message {agentFirst}
          </Link>
        </section>
      )}
    </div>
  );
}
