"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { VisibilityMarker } from "@/components/VisibilityMarker";

type FileItem = {
  id: string;
  fileName: string;
  ext: string;
  mimeType: string | null;
  sizeBytes: number | null;
  visibility: "client_visible" | "internal";
  uploaderName: string | null;
  createdAt: string | Date;
};

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
  background: "var(--white)",
};

const GRID = "40px 1fr 200px 110px auto";

export function FilesClient({ files, projectId, canManage }: { files: FileItem[]; projectId: string; canManage: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [visibility, setVisibility] = useState("client_visible");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("projectId", projectId);
    fd.set("visibility", visibility);
    fd.set("file", file);
    try {
      const res = await fetch("/api/files", { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div className="kicker">Files ({files.length})</div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowUpload((s) => !s)}
            style={{ background: "var(--white)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {showUpload ? "Cancel" : "Upload file · optional"}
          </button>
        )}
      </div>

      {canManage && showUpload && (
        <form
          onSubmit={upload}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14, padding: 14, border: "1px dashed var(--border)", borderRadius: 12, background: "var(--surface-soft)" }}
        >
          <input ref={inputRef} type="file" style={{ fontSize: 13 }} />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)} style={selectStyle}>
            <option value="client_visible">Client-visible</option>
            <option value="internal">Internal only</option>
          </select>
          <button type="submit" disabled={busy} style={{ border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, background: "var(--ink)", color: "var(--white)", cursor: busy ? "default" : "pointer" }}>
            {busy ? "Uploading…" : "Upload"}
          </button>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>New uploads default to client-visible.</span>
        </form>
      )}

      {files.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>No files yet.</p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {files.map((f, i) => (
            <div
              key={f.id}
              style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, alignItems: "center", padding: "11px 14px", borderTop: i === 0 ? "none" : "1px solid var(--border-soft)", background: f.visibility === "internal" ? "var(--surface-soft-2)" : "var(--white)" }}
            >
              <span className="mono" style={{ width: 34, height: 34, borderRadius: 8, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "var(--ink-soft)" }}>
                {f.ext}
              </span>
              <a href={`/api/files/${f.id}`} style={{ fontWeight: 600, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
              </a>
              <span className="mono" style={{ fontSize: 11, color: "var(--muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[fmtBytes(f.sizeBytes), f.uploaderName, new Date(f.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
              </span>
              <span style={{ justifySelf: "start" }}>
                <VisibilityMarker visibility={f.visibility} />
              </span>
              <span style={{ justifySelf: "end" }}>
                {canManage && (
                  <button onClick={() => del(f.id)} title="Delete file" aria-label={`Delete ${f.fileName}`} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 14 }}>
                    🗑
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
