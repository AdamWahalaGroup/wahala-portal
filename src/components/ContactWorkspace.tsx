"use client";

/**
 * Contact workspace panels (the scout's dossier, successor to the lead workspace):
 * the dump + the scout report are the stars; the record fields live compact below.
 * Scout report renders with styled sections (Red flags amber, Score rationale as a
 * green callout).
 */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { ScoreChip } from "@/components/SalesChips";

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
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

export function ContactRecordEditor({
  contactId,
  initial,
  editable,
}: {
  contactId: string;
  initial: { name: string; companyNote: string; email: string; phone: string; source: string; notes: string };
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
      const res = await fetch(`/api/contacts/${contactId}`, {
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
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Record</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(
          [
            ["name", "Name *"],
            ["companyNote", "Company"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["source", "Source"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>{label}</div>
            <input style={inputStyle} value={form[k]} onChange={set(k)} readOnly={!editable} />
          </div>
        ))}
        <div>
          <div className="kicker" style={{ fontSize: 8.5, marginBottom: 3 }}>Notes</div>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            placeholder="Met at the airport bar. Wants a scheduling site…"
            value={form.notes}
            onChange={set("notes")}
            readOnly={!editable}
          />
        </div>
      </div>
      {editable && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <button onClick={save} disabled={busy || !form.name.trim()} style={btn("plain", busy || !form.name.trim())}>
            {busy ? "Saving…" : "Save record"}
          </button>
          {saved && <span style={{ color: "#15803d", fontSize: 12.5, fontWeight: 600 }}>Saved ✓</span>}
          {error && <span style={{ color: "#b00020", fontSize: 12.5 }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- the dump

export function ContactFilesPanel({
  contactId,
  files,
  canDelete,
}: {
  contactId: string;
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
      const res = await fetch(`/api/contacts/${contactId}/files`, { method: "POST", body: form });
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
      const res = await fetch(`/api/contacts/${contactId}/files/${fileId}`, { method: "DELETE" });
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

  const typeChip = (mime: string | null) => {
    const t = mime?.startsWith("image/") ? "IMG" : mime === "application/pdf" ? "PDF" : mime?.startsWith("text/") ? "TXT" : "FILE";
    return (
      <span className="kicker" style={{ fontSize: 8.5, padding: "3px 6px", borderRadius: 5, background: "var(--surface)", color: "var(--ink-soft)", flex: "none" }}>
        {t}
      </span>
    );
  };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span className="kicker">The dump ({files.length})</span>
        <button onClick={() => inputRef.current?.click()} disabled={busy} style={btn("ink", busy)}>
          {busy ? "Uploading…" : "⤓ Drop files"}
        </button>
        <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => upload(e.target.files)} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Always internal — the scout reads all of it.</span>
      </div>
      {files.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            display: "block",
            width: "100%",
            border: "2px dashed var(--muted-line)",
            borderRadius: 14,
            padding: "34px 20px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ⤓ Drop anything you have on this contact — photos, PDFs, screenshots, napkin scans
        </button>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--white)", border: "1px solid #ededf1", borderRadius: 9, padding: "8px 12px" }}>
              {typeChip(f.mimeType)}
              <a href={`/api/contacts/${contactId}/files/${f.id}`} style={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

// ---------------------------------------------------------------- the scout report

/** Split the fixed-section report and style each: Red flags amber, rationale green. */
function ScoutReportBody({ md }: { md: string }) {
  const sections = md.split(/\n(?=## )/g);
  return (
    <div style={{ maxHeight: 640, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
      {sections.map((sec, i) => {
        const heading = /^## (.+)/.exec(sec)?.[1]?.trim() ?? "";
        const body = sec.replace(/^## .+\n?/, "");
        const isRedFlags = /red flags/i.test(heading);
        const isRationale = /score rationale/i.test(heading);
        return (
          <div
            key={i}
            style={
              isRationale
                ? { background: "#DCF5E3", border: "1px solid #BFE8CF", borderRadius: 10, padding: "10px 14px" }
                : { padding: "2px 2px" }
            }
          >
            {heading && (
              <div
                className="kicker"
                style={{ fontSize: 10, marginBottom: 4, color: isRedFlags ? "#B45309" : isRationale ? "#15803D" : "var(--muted)" }}
              >
                {isRedFlags ? "⚠ " : ""}
                {heading}
              </div>
            )}
            <SimpleMarkdown md={body} size={13.5} />
          </div>
        );
      })}
    </div>
  );
}

export function ContactScoutPanel({
  contactId,
  analysisMd,
  score,
  verdict,
  analyzedAt,
  canRun,
}: {
  contactId: string;
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
      const res = await fetch(`/api/contacts/${contactId}/analyze`, {
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

  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <span className="kicker">Scout report</span>
        {score !== null && <ScoreChip score={score} verdict={verdict} size="lg" />}
        {canRun && (
          <button onClick={run} disabled={busy} style={btn("green", busy)}>
            {busy ? "Scouting (web recon + read, ~40s)…" : analysisMd ? "◆ Re-run the scout with AI" : "◆ Analyze this contact with AI"}
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
          <ScoutReportBody md={analysisMd} />
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "34px 20px", textAlign: "center", background: "var(--white)" }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>◆</div>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
            No scout report yet — it reads the record, the dump, and the web, then scores whether this
            contact is worth the effort (~40s).
          </p>
        </div>
      )}
    </section>
  );
}
