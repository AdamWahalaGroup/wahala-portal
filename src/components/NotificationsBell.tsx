"use client";

/**
 * Notifications bell for the AppShell sidebar (staff only). Shows the unread count;
 * opening the dropdown lists recent nudges and marks them read. Deep links jump to
 * the deal / proposal / lead the nudge is about.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; kind: string; title: string; body: string; href: string; readAt: string | null; createdAt: string };

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* offline — leave prior state */
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((cur) => cur.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
      fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }).catch(() => {});
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        title="Notifications"
        style={{
          position: "relative",
          background: "transparent",
          border: "1px solid #2c2f36",
          color: "#aeb2bb",
          borderRadius: 8,
          padding: "5px 9px",
          fontSize: 14,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        🔔
        {unread > 0 && (
          <span
            className="tabular"
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--cobalt)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 300,
            maxHeight: 380,
            overflowY: "auto",
            background: "var(--white)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 24px 60px -24px rgba(0,0,0,.35)",
            zIndex: 50,
            padding: 6,
          }}
        >
          <div className="kicker" style={{ padding: "6px 8px", color: "var(--muted)" }}>Notifications</div>
          {items.length === 0 ? (
            <p style={{ margin: 0, padding: "12px 10px", fontSize: 13, color: "var(--muted)" }}>You&apos;re all caught up.</p>
          ) : (
            items.map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  setOpen(false);
                  router.push(i.href.replace(/^https?:\/\/[^/]+/, ""));
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: i.readAt ? "transparent" : "var(--cobalt-wash)",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 10px",
                  cursor: "pointer",
                  marginBottom: 2,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", lineHeight: 1.25 }}>{i.title}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--muted-line)", flex: "none" }}>{ago(i.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>{i.body}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
