"use client";

/**
 * The staff markdown pattern (design handoff, sales/00-overview.md): rendered
 * markdown by default, "Edit" toggles into a textarea with "Save edits" / Cancel.
 * onSave returns an error message or null.
 */
import { useState } from "react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

export function MarkdownPanel({
  value,
  editable,
  onSave,
  placeholder,
  minHeight = 220,
  maxHeight,
  size = 13.5,
}: {
  value: string;
  editable: boolean;
  onSave?: (next: string) => Promise<string | null>;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  size?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!onSave) return;
    setBusy(true);
    setError(null);
    const err = await onSave(draft);
    if (err) setError(err);
    else setEditing(false);
    setBusy(false);
  }

  if (editing) {
    return (
      <div>
        <textarea
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #d7d9df",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 12.5,
            lineHeight: 1.55,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            minHeight: Math.max(minHeight, 200),
            resize: "vertical",
            background: "var(--white)",
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <button
            onClick={save}
            disabled={busy}
            style={{ background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 8, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {busy ? "Saving…" : "Save edits"}
          </button>
          <button
            onClick={() => {
              setDraft(value);
              setEditing(false);
              setError(null);
            }}
            style={{ background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Cancel
          </button>
          {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          background: "var(--white)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          ...(maxHeight ? { maxHeight, overflowY: "auto" as const } : {}),
        }}
      >
        {value.trim() ? (
          <SimpleMarkdown md={value} size={size} />
        ) : (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>{placeholder ?? "Nothing here yet."}</p>
        )}
      </div>
      {editable && onSave && (
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          style={{ marginTop: 8, background: "var(--white)", color: "var(--ink)", border: "1px solid #d7d9df", borderRadius: 8, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
        >
          Edit
        </button>
      )}
    </div>
  );
}
