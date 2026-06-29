"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";

type State = "idle" | "sending" | "sent" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  link_invalid: "That sign-in link is invalid or has expired. Request a new one.",
  sso_no_account: "No Wahala account is linked to that Google email. Ask your account owner for an invite.",
  account_disabled: "That account is disabled. Contact your Wahala account owner.",
  sso_unverified: "Your Google email isn't verified, so we can't sign you in.",
  sso_failed: "Google sign-in didn't complete. Please try again.",
  sso_unavailable: "Google sign-in isn't available right now — use a magic link instead.",
  sso_unknown_provider: "Unknown sign-in provider.",
};

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.2 5.6c4.2-3.9 6.6-9.6 6.6-17.1z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.2-5.6c-2 1.4-4.6 2.2-7.8 2.2-6.4 0-11.8-3.8-13.7-9.4l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  fontSize: 15,
  border: "1px solid var(--border)",
  borderRadius: 9,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setUrlError(ERROR_MESSAGES[code] ?? "Something went wrong signing in.");
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; devLink?: string };
      if (!res.ok) {
        setState("error");
        setMessage(data.message ?? "We couldn't send that link.");
        return;
      }
      setState("sent");
      setMessage(data.message ?? "Check your email for a sign-in link.");
      setDevLink(data.devLink ?? null);
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--surface-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-card)",
          padding: 30,
        }}
      >
        <Brand size={24} />

        {state === "sent" ? (
          <div style={{ marginTop: 26 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--cobalt-wash)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              ✉
            </div>
            <h1 style={{ margin: "16px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>
              Check your email
            </h1>
            <p style={{ margin: "8px 0 0", color: "var(--ink-soft)", fontSize: 14.5 }}>{message}</p>
            {devLink && (
              <p style={{ marginTop: 14, fontSize: 13 }}>
                <span className="kicker">dev link</span>
                <br />
                <a href={devLink}>{devLink}</a>
              </p>
            )}
            <button
              onClick={() => {
                setState("idle");
                setMessage("");
              }}
              style={{
                marginTop: 18,
                background: "transparent",
                border: "none",
                color: "var(--cobalt-text)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <h1 style={{ margin: "24px 0 0", fontSize: 27, fontWeight: 800, letterSpacing: "-.025em" }}>Sign in</h1>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14.5 }}>
              Continue with Google, or get a one-time link by email — no passwords.
            </p>

            {urlError && (
              <div
                style={{
                  marginTop: 18,
                  background: "#fbe3e3",
                  border: "1px solid #f3c9c9",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13.5,
                }}
              >
                {urlError}
              </div>
            )}

            <a
              href="/api/auth/sso/google"
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "11px",
                fontSize: 14.5,
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: 9,
                background: "var(--white)",
                color: "var(--ink)",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              <GoogleIcon /> Continue with Google
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 2px" }}>
              <span style={{ height: 1, background: "var(--border)", flex: 1 }} />
              <span className="kicker" style={{ fontSize: 10 }}>
                or
              </span>
              <span style={{ height: 1, background: "var(--border)", flex: 1 }} />
            </div>

            {state === "error" && (
              <div
                style={{
                  marginTop: 18,
                  background: "#fbe3e3",
                  border: "1px solid #f3c9c9",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13.5,
                  fontWeight: 500,
                }}
              >
                {message}
              </div>
            )}

            <form onSubmit={onSubmit} style={{ marginTop: 22 }}>
              <label htmlFor="email" className="kicker" style={{ display: "block", marginBottom: 7 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={state === "sending"}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 9,
                  background: state === "sending" ? "#3a3f47" : "var(--ink)",
                  color: "var(--white)",
                  cursor: state === "sending" ? "default" : "pointer",
                }}
              >
                {state === "sending" ? "Sending…" : "Send magic link"}
              </button>
            </form>

            <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 12.5 }}>
              Access is invite-only. Trouble signing in? Ask your Wahala account owner.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
