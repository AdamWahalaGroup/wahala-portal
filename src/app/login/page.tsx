"use client";

import { useState } from "react";
import { Brand } from "@/components/Brand";

type State = "idle" | "sending" | "sent" | "error";

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
              We&apos;ll email you a one-time sign-in link — no passwords.
            </p>

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
