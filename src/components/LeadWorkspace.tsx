"use client";

/**
 * Lead workspace panels: the editable record + notes, the unorganized dump
 * (files/photos/anything), and the AI scout (web recon + opinion + 1–10 score).
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13.5,
  background: "var(--white)",
  width: "100%",
  boxSizing: "border-box",
};

const btn = (tone: "ink" | "green" | "plain", disabled: boolean): React.CSSProperties => ({
  background: tone === "ink" ? "var(--ink)" : tone === "green" ? "#16a34a" : "var(--white)",
  color: tone === "plain" ? "var(--ink)" : "var(--white)",
  border: tone === "plain" ? "1px solid #d7d9df" : "1px solid transparent",
  borderRadius: 8,
  padding: "9px 15px",
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.55 : 1,
});

function fmtBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------- record editor

export function LeadRecordEditor({
  leadId,
  initial,
  editable,
}: {
  leadId: string;
  initial: { name: string; company: string; email: string; phone: string; source: string; industry: string; notes: string };
  editable: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", ...form }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {(
          [
            ["name", "Name *"],
            ["company", "Company"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["source", "Source"],
            ["industry", "Industry"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
            <input style={inputStyle} value={form[k]} onChange={set(k)} readOnly={!editable} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Notes — anything at all</div>
        <textarea
          style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          placeholder="Met at the airport bar. Wants a scheduling site. Mentioned his cousin runs the parts supplier…"
          value={form.notes}
          onChange={set("notes")}
          readOnly={!editable}
        />
      </div>
      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={save} disabled={busy || !form.name.trim()} style={btn("plain", busy || !form.name.trim())}>
            {busy ? "Saving…" : "Save record"}
          </button>
          {saved && <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Saved ✓</span>}
          {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the dump

export function LeadFilesPanel({
  leadId,
  files,
  canDelete,
}: {
  leadId: string;
  files: { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null; uploaderName: string | null }[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of Array.from(list)) form.append("files", f);
      const res = await fetch(`/api/leads/${leadId}/files`, { method: "POST", body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Upload failed (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(fileId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Delete failed (${res.status}).`);
      } else router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="kicker">The dump ({files.length})</span>
        <button onClick={() => inputRef.current?.click()} disabled={busy} style={btn("ink", busy)}>
          {busy ? "Uploading…" : "+ Drop files"}
        </button>
        <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => upload(e.target.files)} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Photos, PDFs, screenshots, napkin scans — anything about this lead. The scout reads all of it.
        </span>
      </div>
      {files.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>Nothing dumped yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--white)", border: "1px solid #ededf1", borderRadius: 9, padding: "8px 12px" }}>
              <span style={{ fontSize: 15 }}>{f.mimeType?.startsWith("image/") ? "🖼" : f.mimeType === "application/pdf" ? "📄" : "📎"}</span>
              <a href={`/api/leads/${leadId}/files/${f.id}`} style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
              </a>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)", flex: "none" }}>
                {fmtBytes(f.sizeBytes)}
                {f.uploaderName ? ` · ${f.uploaderName}` : ""}
              </span>
              {canDelete && (
                <button onClick={() => remove(f.id)} disabled={busy} style={{ ...btn("plain", busy), padding: "4px 9px", fontSize: 11.5, color: "#b91c1c", borderColor: "#f0caca" }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- the scout

const VERDICT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pursue: { bg: "#e8f7ee", color: "#15803d", label: "PURSUE" },
  probe: { bg: "#fff7ed", color: "#b45309", label: "PROBE" },
  pass: { bg: "#fdeeee", color: "#b91c1c", label: "PASS" },
};

export function LeadScoutPanel({
  leadId,
  analysisMd,
  score,
  verdict,
  analyzedAt,
  canRun,
}: {
  leadId: string;
  analysisMd: string | null;
  score: number | null;
  verdict: string | null;
  analyzedAt: string | Date | null;
  canRun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        usage?: { costCents: number };
        webUsed?: boolean;
      };
      if (!res.ok) setError(data.message ?? `Failed (${res.status}).`);
      else {
        setStatus(
          `Scouted${data.webUsed ? " with live web recon" : " (web lookup unavailable this run)"}${
            data.usage ? ` · ≈ $${(data.usage.costCents / 100).toFixed(2)}` : ""
          }`,
        );
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const v = verdict ? VERDICT_STYLE[verdict] : null;

  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <span className="kicker">Scout report</span>
        {score !== null && v && (
          <span className="kicker" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, background: v.bg, color: v.color }}>
            {score}/10 · {v.label}
          </span>
        )}
        {canRun && (
          <button onClick={run} disabled={busy} style={btn("green", busy)}>
            {busy ? "Scouting (web recon + read, ~40s)…" : analysisMd ? "◆ Re-run the scout" : "◆ Analyze this lead"}
          </button>
        )}
        {analyzedAt && (
          <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            last run {new Date(analyzedAt).toLocaleString()}
          </span>
        )}
      </div>
      {status && <p style={{ color: "#15803d", fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>{status}</p>}
      {error && <p style={{ color: "#b00020", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}
      {analysisMd ? (
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
          <SimpleMarkdown md={analysisMd} size={13.5} />
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
          No scout report yet. Drop what you have into the dump, then run the scout — it reads everything,
          checks the web, and scores whether this lead is worth the effort.
        </p>
      )}
    </section>
  );
}
