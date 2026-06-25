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

      <p style={{ marginTop: 32, color: "#888", fontSize: 14 }}>
        Auth is AWS Cognito (wired in Phase 1; see <code>src/lib/auth.ts</code>).
        Next: the Phase 1 loop — onboarding → owner → client account → stage
        cycle. See <code>docs/PLAN.md</code>.
      </p>
    </main>
  );
}
