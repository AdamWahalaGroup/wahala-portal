export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Wahala Portal</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Client services CRM &amp; portal — Phase 0 skeleton.
      </p>

      <p style={{ marginTop: 16 }}>
        <a href="/login">Sign in →</a>
      </p>

      <p style={{ marginTop: 32, color: "#888", fontSize: 14 }}>
        Stack: Next.js (App Router) on Cloudflare Workers via OpenNext, with D1
        (Drizzle) + KV (sessions) + R2 (files) + Cloudflare Email (magic-link
        login) + Stripe. No external identity provider. Next: the magic-link
        auth flow and the Phase 1 loop — see <code>docs/PLAN.md</code> and
        <code> phase-0.md</code>.
      </p>
    </main>
  );
}
