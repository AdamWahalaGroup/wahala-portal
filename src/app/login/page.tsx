"use client";

import { useState } from "react";

type State = "idle" | "sending" | "sent" | "error";

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
      const data = (await res.json()) as {
        message?: string;
        devLink?: string;
      };
      if (!res.ok) {
        setState("error");
        setMessage(data.message ?? "Something went wrong.");
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
        fontFamily: "system-ui, sans-serif",
        maxWidth: 420,
        margin: "0 auto",
        padding: "64px 24px",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Sign in</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Wahala Portal — we&apos;ll email you a one-time sign-in link.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 24 }}>
        <label
          htmlFor="email"
          style={{ display: "block", fontSize: 14, marginBottom: 6 }}
        >
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
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            border: "none",
            borderRadius: 8,
            background: state === "sending" ? "#888" : "#111",
            color: "#fff",
            cursor: state === "sending" ? "default" : "pointer",
          }}
        >
          {state === "sending" ? "Sending…" : "Send sign-in link"}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: 16,
            color: state === "error" ? "#b00020" : "#0a7d28",
            fontSize: 14,
          }}
        >
          {message}
        </p>
      )}

      {devLink && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          <strong>Dev link:</strong>{" "}
          <a href={devLink}>{devLink}</a>
        </p>
      )}
    </main>
  );
}
