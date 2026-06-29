"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Thread composer (design frame 11): input + optional "needs a reply" flag + Send. */
export function MessageComposer({ projectId, isStaff }: { projectId: string; isStaff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [needsReply, setNeedsReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          body: text,
          // Flag the ball as in the OTHER party's court when "needs a reply" is set.
          waitingOn: needsReply ? (isStaff ? "client" : "wahala") : "none",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
        return;
      }
      setBody("");
      setNeedsReply(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--white)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a message…  (⌘/Ctrl + Enter to send)"
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 160,
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxSizing: "border-box",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          style={{
            border: "none",
            borderRadius: 10,
            padding: "11px 18px",
            fontSize: 14,
            fontWeight: 600,
            background: busy || !body.trim() ? "var(--surface)" : "var(--ink)",
            color: busy || !body.trim() ? "var(--muted-line)" : "var(--white)",
            cursor: busy || !body.trim() ? "default" : "pointer",
            flex: "none",
          }}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12.5, color: "var(--muted)", cursor: "pointer" }}>
        <input type="checkbox" checked={needsReply} onChange={(e) => setNeedsReply(e.target.checked)} />
        Needs a reply from {isStaff ? "the client" : "Wahala"}
      </label>
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
