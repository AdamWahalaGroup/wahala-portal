/**
 * Draft a project with AI — frames 18 (Upload) → 19 (Analyzing) → 20 (Review & edit).
 *
 * State is browser-only — NOTHING is persisted until the staffer presses "Create
 * project →". The model call (POST /api/projects/ai-draft) runs as multipart so
 * PDFs/images go straight to the provider; the editable draft is then sent back via
 * POST /api/projects/ai-create.
 */
"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

type Org = { id: string; name: string };

type DraftDeliverable = { id: string; description: string };
type DraftEpic = { id: string; name: string; deliverables: DraftDeliverable[] };
type DraftStage = { id: string; name: string; scopeDescription: string; epics: DraftEpic[] };

type Draft = {
  name: string;
  description: string;
  workType: string;
  stages: DraftStage[];
  clientMessage: string;
  projectContextMd: string;
};

type Usage = { model: string; inputTokens: number; outputTokens: number; costCents: number };

type ApiDraft = {
  name: string;
  description: string;
  workType: string;
  stages: { name: string; scopeDescription: string; deliverables: { epic: string; description: string }[] }[];
  clientMessage: string;
  projectContextMd: string;
};

const rid = () => Math.random().toString(36).slice(2, 10);
const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_CHIPS: Record<string, { label: string; bg: string; fg: string }> = {
  pdf: { label: "PDF", bg: "#FDECEB", fg: "#C0392B" },
  md: { label: "MD", bg: "#EEF0FE", fg: "#2536C4" },
  txt: { label: "TXT", bg: "#F1F2F4", fg: "#4B5159" },
  jpg: { label: "IMG", bg: "#F0ECFB", fg: "#6D28D9" },
  png: { label: "IMG", bg: "#F0ECFB", fg: "#6D28D9" },
};
function chipFor(name: string) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return TYPE_CHIPS[ext === "jpeg" ? "jpg" : ext] ?? { label: ext.toUpperCase() || "FILE", bg: "#F1F2F4", fg: "#4B5159" };
}

function apiDraftToLocal(api: ApiDraft): Draft {
  return {
    name: api.name ?? "",
    description: api.description ?? "",
    workType: api.workType ?? "",
    clientMessage: api.clientMessage ?? "",
    projectContextMd: api.projectContextMd ?? "",
    stages: (api.stages ?? []).map((s) => {
      const epics: DraftEpic[] = [];
      for (const d of s.deliverables ?? []) {
        const found = epics.find((x) => x.name === d.epic);
        if (found) found.deliverables.push({ id: rid(), description: d.description });
        else epics.push({ id: rid(), name: d.epic, deliverables: [{ id: rid(), description: d.description }] });
      }
      return { id: rid(), name: s.name ?? "", scopeDescription: s.scopeDescription ?? "", epics };
    }),
  };
}

function localToCreate(d: Draft, organizationId: string, postToThread: boolean) {
  return {
    organizationId,
    name: d.name,
    description: d.description,
    workType: d.workType,
    aiContextMd: d.projectContextMd,
    clientMessage: d.clientMessage,
    postToThread,
    stages: d.stages.map((s) => ({
      name: s.name,
      scopeDescription: s.scopeDescription || undefined,
      deliverables: s.epics.flatMap((e) => e.deliverables.map((dl) => ({ epic: e.name, description: dl.description }))),
    })),
  };
}

const COBALT = "#2536C4";
const COBALT_SOFT = "#EEF0FE";
const COBALT_BORDER = "#C9D0FB";

export function AiDraftFlow({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"upload" | "analyzing" | "review">("upload");
  const [orgId, setOrgId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [postToThread, setPostToThread] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDraft() {
    setError(null);
    if (!orgId) {
      setError("Pick a client first.");
      return;
    }
    if (files.length === 0 && !pastedText.trim()) {
      setError("Drop in at least one file or paste some notes.");
      return;
    }
    setPhase("analyzing");
    const fd = new FormData();
    fd.append("organizationId", orgId);
    // On redraft (draft already exists), include the edited memo so the model sees
    // any answers the staffer typed inline (under open questions, next to gaps, etc.)
    // and honors them. First draft: send only the paste; no memo yet to send.
    let augmented = pastedText.trim();
    if (draft?.projectContextMd.trim()) {
      const memoBlock = `# Previous draft's project-context.md (WITH the staffer's inline answers and edits)\n\n${draft.projectContextMd.trim()}\n\n(Instruction to model: anything the staffer typed inside this memo is authoritative. Treat their edits as answers to prior open questions, as newly-known facts that resolve gaps in "Missing information", and as revisions to any assumption that conflicts with them. Do NOT ask the same questions again in this next draft.)`;
      augmented = augmented ? `${augmented}\n\n---\n\n${memoBlock}` : memoBlock;
    }
    if (augmented) fd.append("pastedText", augmented);
    for (const f of files) fd.append("files", f, f.name);
    try {
      const res = await fetch("/api/projects/ai-draft", { method: "POST", body: fd });
      const data = (await res.json()) as { draft?: ApiDraft; usage?: Usage; message?: string };
      if (!res.ok || !data.draft) throw new Error(data.message ?? "Draft failed.");
      setDraft(apiDraftToLocal(data.draft));
      setUsage(data.usage ?? null);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("upload");
    }
  }

  async function createProject() {
    if (!draft || !orgId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/ai-create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(localToCreate(draft, orgId, postToThread)),
      });
      const data = (await res.json()) as { project?: { id: string }; message?: string };
      if (!res.ok || !data.project) throw new Error(data.message ?? "Create failed.");
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  if (phase === "analyzing") return <Analyzing usageHint={usage} />;
  if (phase === "review" && draft) {
    return (
      <Review
        draft={draft}
        setDraft={setDraft}
        usage={usage}
        files={files}
        orgName={orgs.find((o) => o.id === orgId)?.name ?? ""}
        postToThread={postToThread}
        setPostToThread={setPostToThread}
        submitting={submitting}
        error={error}
        onRedraft={runDraft}
        onCreate={createProject}
        onDiscard={() => {
          setDraft(null);
          setUsage(null);
          setPhase("upload");
        }}
      />
    );
  }
  return (
    <Upload
      orgs={orgs}
      orgId={orgId}
      setOrgId={setOrgId}
      files={files}
      setFiles={setFiles}
      pastedText={pastedText}
      setPastedText={setPastedText}
      onDraft={runDraft}
      error={error}
    />
  );
}

// ─── Frame 18: Upload ────────────────────────────────────────────────────────

function Upload(props: {
  orgs: Org[];
  orgId: string;
  setOrgId: (v: string) => void;
  files: File[];
  setFiles: (f: File[]) => void;
  pastedText: string;
  setPastedText: (v: string) => void;
  onDraft: () => void;
  error: string | null;
}) {
  const { orgs, orgId, setOrgId, files, setFiles, pastedText, setPastedText, onDraft, error } = props;
  const [dragging, setDragging] = useState(false);
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: COBALT, fontSize: 18 }}>◆</span>
        <div>
          <div className="kicker" style={{ color: COBALT }}>Wahala AI</div>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>Draft a project</h1>
        </div>
      </div>
      <p style={{ margin: "8px 0 22px", color: "var(--muted)", fontSize: 14.5 }}>
        Pick a client, drop in a proposal / SOW / notes (PDF, images, .txt, .md, or pasted text). The model drafts
        the whole project — phases, deliverables grouped by focus area, and a first client message — and you edit it before saving.
      </p>

      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Client</label>
        <select
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--border)", borderRadius: 9, background: "var(--white)" }}
        >
          <option value="">Pick a client…</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = Array.from(e.dataTransfer.files);
            if (dropped.length) setFiles([...files, ...dropped]);
          }}
          style={{
            display: "block",
            marginTop: 18,
            border: `1.5px dashed ${COBALT_BORDER}`,
            background: dragging ? "#F3F5FF" : "#FAFBFF",
            borderRadius: 12,
            padding: "26px 16px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 22, color: COBALT, lineHeight: 1 }}>⤓</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>Drop files here, or browse</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>PDF · MD · TXT · PNG · JPG</div>
          <input
            type="file"
            multiple
            accept=".pdf,.md,.txt,.png,.jpg,.jpeg,application/pdf,text/plain,text/markdown,image/*"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setFiles([...files, ...picked]);
              e.currentTarget.value = "";
            }}
            style={{ display: "none" }}
          />
        </label>

        {files.length > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f, i) => {
              const chip = chipFor(f.name);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--border-soft)", borderRadius: 10, background: "var(--surface-soft)" }}>
                  <span className="kicker" style={{ background: chip.bg, color: chip.fg, padding: "3px 7px", borderRadius: 6 }}>{chip.label}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{Math.round(f.size / 1024)} KB</div>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 16, cursor: "pointer" }}
                    aria-label="Remove file"
                  >×</button>
                </div>
              );
            })}
          </div>
        )}

        <label className="kicker" style={{ display: "block", marginTop: 18, marginBottom: 6 }}>…or paste meeting notes / an email thread</label>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste the proposal, SOW, meeting notes, or an email thread…"
          rows={6}
          style={{ width: "100%", padding: "10px 12px", fontSize: 13.5, border: "1px solid var(--border)", borderRadius: 9, background: "var(--white)", resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "#16a34a" }} />
            <span className="mono">≈ $0.03–0.05 per draft · lightweight model</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/dashboard/projects/new" style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}>Start blank instead</a>
            <button
              type="button"
              onClick={onDraft}
              style={{ padding: "10px 16px", fontSize: 14, fontWeight: 700, color: "var(--white)", background: "var(--ink)", border: "none", borderRadius: 10, cursor: "pointer" }}
            >◆ Draft project with AI →</button>
          </div>
        </div>

        {error && <ErrorBox text={error} />}
      </div>
    </div>
  );
}

// ─── Frame 19: Analyzing ─────────────────────────────────────────────────────

function Analyzing({ usageHint }: { usageHint: Usage | null }) {
  return (
    <div style={{ maxWidth: 560, margin: "60px auto 0" }}>
      <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: COBALT, fontSize: 18 }}>◆</span>
          <div className="kicker" style={{ color: COBALT }}>Wahala AI</div>
        </div>
        <h2 style={{ margin: "10px 0 6px", fontSize: 19, fontWeight: 800 }}>Reading your documents…</h2>
        <ul style={{ margin: "12px 0 14px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          <Step done text="Extracted text" />
          <Step done text="Identified phases" />
          <Step current text="Drafting phases & deliverables" />
          <Step text="Writing the client message + context memo" />
        </ul>
        <div style={{ height: 4, background: COBALT_SOFT, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "70%", background: COBALT, animation: "pulse 1.4s ease-in-out infinite" }} />
        </div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
          single-pass · {usageHint ? `${usageHint.model}` : "lightweight model"}
        </div>
      </div>
    </div>
  );
}

function Step({ done, current, text }: { done?: boolean; current?: boolean; text: string }) {
  const color = done ? "#16a34a" : current ? "#D97706" : "var(--muted-line)";
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, border: current ? `2px solid ${color}` : "none", background: done ? color : "transparent", color: "var(--white)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{done ? "✓" : ""}</span>
      <span style={{ color: done || current ? "var(--ink)" : "var(--muted)", fontWeight: current ? 700 : 500 }}>{text}</span>
    </li>
  );
}

// ─── Frame 20: Review & edit ─────────────────────────────────────────────────

function Review(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  usage: Usage | null;
  files: File[];
  orgName: string;
  postToThread: boolean;
  setPostToThread: (v: boolean) => void;
  submitting: boolean;
  error: string | null;
  onRedraft: () => void;
  onCreate: () => void;
  onDiscard: () => void;
}) {
  const { draft, setDraft, usage, files, orgName, postToThread, setPostToThread, submitting, error, onRedraft, onCreate, onDiscard } = props;

  function updateStage(id: string, patch: Partial<DraftStage>) {
    setDraft({ ...draft, stages: draft.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function addStage() {
    setDraft({ ...draft, stages: [...draft.stages, { id: rid(), name: `Phase ${draft.stages.length + 1}`, scopeDescription: "", epics: [] }] });
  }
  function removeStage(id: string) {
    setDraft({ ...draft, stages: draft.stages.filter((s) => s.id !== id) });
  }
  function addEpic(stageId: string) {
    updateStage(stageId, {
      epics: [...(draft.stages.find((s) => s.id === stageId)?.epics ?? []), { id: rid(), name: "New focus area", deliverables: [] }],
    });
  }
  function updateEpic(stageId: string, epicId: string, patch: Partial<DraftEpic>) {
    const s = draft.stages.find((x) => x.id === stageId);
    if (!s) return;
    updateStage(stageId, { epics: s.epics.map((e) => (e.id === epicId ? { ...e, ...patch } : e)) });
  }
  function removeEpic(stageId: string, epicId: string) {
    const s = draft.stages.find((x) => x.id === stageId);
    if (!s) return;
    updateStage(stageId, { epics: s.epics.filter((e) => e.id !== epicId) });
  }
  function addDeliverable(stageId: string, epicId: string) {
    const s = draft.stages.find((x) => x.id === stageId);
    const e = s?.epics.find((x) => x.id === epicId);
    if (!s || !e) return;
    updateEpic(stageId, epicId, { deliverables: [...e.deliverables, { id: rid(), description: "" }] });
  }
  function updateDeliverable(stageId: string, epicId: string, delId: string, description: string) {
    const s = draft.stages.find((x) => x.id === stageId);
    const e = s?.epics.find((x) => x.id === epicId);
    if (!s || !e) return;
    updateEpic(stageId, epicId, { deliverables: e.deliverables.map((d) => (d.id === delId ? { ...d, description } : d)) });
  }
  function removeDeliverable(stageId: string, epicId: string, delId: string) {
    const s = draft.stages.find((x) => x.id === stageId);
    const e = s?.epics.find((x) => x.id === epicId);
    if (!s || !e) return;
    updateEpic(stageId, epicId, { deliverables: e.deliverables.filter((d) => d.id !== delId) });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="kicker" style={{ background: COBALT_SOFT, color: COBALT, padding: "4px 9px", borderRadius: 999 }}>◆ Drafted by Wahala AI</span>
          <h1 style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>Review draft</h1>
          <div className="mono" style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {orgName} · from {files.length} source{files.length === 1 ? "" : "s"} · nothing saved yet
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onDiscard} disabled={submitting} style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, background: "var(--white)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 10, cursor: submitting ? "not-allowed" : "pointer" }}>Discard</button>
          <button type="button" onClick={onCreate} disabled={submitting} style={{ padding: "10px 16px", fontSize: 14, fontWeight: 700, background: "var(--ink)", color: "var(--white)", border: "none", borderRadius: 10, cursor: submitting ? "wait" : "pointer" }}>
            {submitting ? "Creating…" : "Create project →"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, background: COBALT_SOFT, border: `1px solid ${COBALT_BORDER}`, color: COBALT, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
        Every field below is editable. The project, its phases, and the client message are created only when you press <strong>Create project</strong>.
      </div>

      {error && <ErrorBox text={error} />}

      <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 360px", gap: 22, alignItems: "start" }}>
        {/* LEFT — editable draft */}
        <div>
          <Field label="Project name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp(20, 700)} />
          </Field>
          <Field label="Work type">
            <input value={draft.workType} onChange={(e) => setDraft({ ...draft, workType: e.target.value })} style={inp()} />
            <div className="kicker" style={{ marginTop: 4, color: "var(--muted)" }}>{draft.stages.length} phase{draft.stages.length === 1 ? "" : "s"} · prices set later</div>
          </Field>
          <Field label="Description">
            <AutoSizingTextarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} minRows={3} style={{ ...inp(), resize: "vertical", fontFamily: "inherit" }} />
          </Field>

          <div className="kicker" style={{ marginTop: 24, marginBottom: 10 }}>Phases & deliverables · drafted from the SOW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {draft.stages.map((s, i) => (
              <div key={s.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "var(--ink)", color: "var(--white)", width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</span>
                  <input value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} placeholder="Phase name" style={{ flex: 1, ...inp(15, 700), border: "none", background: "transparent", padding: "4px 0" }} />
                  <button type="button" onClick={() => removeStage(s.id)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 18, cursor: "pointer" }} aria-label="Remove phase">×</button>
                </div>
                <AutoSizingTextarea value={s.scopeDescription} onChange={(e) => updateStage(s.id, { scopeDescription: e.target.value })} placeholder="Scope of this phase…" minRows={2} style={{ marginTop: 8, ...inp(), resize: "vertical", fontFamily: "inherit" }} />

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  {s.epics.map((e) => (
                    <div key={e.id} style={{ background: "var(--surface-soft)", border: "1px solid var(--border-soft)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input value={e.name} onChange={(ev) => updateEpic(s.id, e.id, { name: ev.target.value })} placeholder="Focus area" className="kicker" style={{ flex: 1, padding: "4px 6px", fontSize: 11.5, color: COBALT, background: "transparent", border: "none", outline: "none", letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700 }} />
                        <button type="button" onClick={() => removeEpic(s.id, e.id)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 14, cursor: "pointer" }} aria-label="Remove focus area">×</button>
                      </div>
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        {e.deliverables.map((d) => (
                          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px dashed var(--border-soft)", padding: "4px 0" }}>
                            <span style={{ width: 6, height: 6, background: COBALT, transform: "rotate(45deg)" }} />
                            <input value={d.description} onChange={(ev) => updateDeliverable(s.id, e.id, d.id, ev.target.value)} placeholder="Deliverable" style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, padding: "4px 0" }} />
                            <button type="button" onClick={() => removeDeliverable(s.id, e.id, d.id)} style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }} aria-label="Remove deliverable">×</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addDeliverable(s.id, e.id)} style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: COBALT, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>+ Add deliverable</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addEpic(s.id)} style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, color: COBALT, background: COBALT_SOFT, border: `1px solid ${COBALT_BORDER}`, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>+ Add focus area</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addStage} style={{ alignSelf: "flex-start", fontSize: 13.5, fontWeight: 700, color: "var(--ink)", background: "var(--white)", border: "1.5px dashed var(--border)", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}>+ Add phase</button>
          </div>

          <div style={{ marginTop: 24, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>First message to the client</div>
            <textarea value={draft.clientMessage} onChange={(e) => setDraft({ ...draft, clientMessage: e.target.value })} rows={6} style={{ ...inp(), resize: "vertical", fontFamily: "inherit" }} />
            <label style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={postToThread} onChange={(e) => setPostToThread(e.target.checked)} />
              Post to the account thread on create
            </label>
          </div>
        </div>

        {/* RIGHT rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 16 }}>
          <MissingInfoCallout memo={draft.projectContextMd} onRedraft={onRedraft} disabled={submitting} />
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ background: "var(--ink)", color: "var(--white)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: COBALT_BORDER }}>◆</span>
              <span className="mono" style={{ fontSize: 12 }}>project-context.md</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--muted-line)" }}>Edit</span>
            </div>
            <textarea
              value={draft.projectContextMd}
              onChange={(e) => setDraft({ ...draft, projectContextMd: e.target.value })}
              rows={16}
              className="mono"
              style={{ width: "100%", padding: 12, fontSize: 11.5, border: "none", background: "#FBFBFC", outline: "none", resize: "vertical", lineHeight: 1.5 }}
            />
            <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-soft)", fontSize: 11.5, color: "var(--muted)" }}>
              Saved with the project as the agent's memory — future AI actions start from this, so they stay cheap and on-context.
            </div>
          </div>

          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Sources</div>
            {files.length === 0 && <div style={{ fontSize: 13, color: "var(--muted)" }}>Pasted text only.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {files.map((f, i) => {
                const c = chipFor(f.name);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span className="kicker" style={{ background: c.bg, color: c.fg, padding: "2px 6px", borderRadius: 5 }}>{c.label}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={onRedraft} disabled={submitting} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: COBALT, background: COBALT_SOFT, border: `1px solid ${COBALT_BORDER}`, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>↻ Re-draft from sources with AI</button>
          </div>

          {usage && (
            <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
              <div className="kicker" style={{ marginBottom: 4 }}>Usage</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>This draft</div>
              <div className="tabular" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>{usd(usage.costCents)}</div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out · {usage.model}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="kicker" style={{ marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function inp(fontSize = 14, fontWeight = 500): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", fontSize, fontWeight, border: "1px solid var(--border)", borderRadius: 9, background: "var(--white)", outline: "none" };
}
function ErrorBox({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 14, background: "#FBE3E3", border: "1px solid #F4A8A8", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{text}</div>
  );
}

/**
 * Textarea that sizes itself to fit its initial content on mount, so an AI-generated
 * paragraph doesn't land in a 3-line box the admin has to drag open. User can still
 * drag-resize (resize: "vertical" is preserved by the caller); we only set the initial
 * height once — subsequent edits don't reflow. minRows guarantees a floor.
 */
function AutoSizingTextarea({
  minRows = 2,
  style,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []); // once, on mount — Review only mounts after the draft arrives.
  return <textarea ref={ref} rows={minRows} style={style} {...rest} />;
}

/** Parse the '## Missing information' section of the memo into (blocking, nice-to-have) counts. */
function countMissingInfo(memo: string): { blocking: number; niceToHave: number } {
  const m = memo.match(/##\s*Missing information\s*\n([\s\S]*?)(?=\n##\s|\s*$)/i);
  if (!m) return { blocking: 0, niceToHave: 0 };
  const lines = m[1].split("\n").map((l) => l.trim()).filter((l) => l.startsWith("-"));
  // A single "None — …" bullet means the model reported no gaps.
  if (lines.length === 1 && /^-\s*\*?\*?none/i.test(lines[0])) return { blocking: 0, niceToHave: 0 };
  let blocking = 0;
  let niceToHave = 0;
  for (const l of lines) {
    if (/\(blocking\)/i.test(l)) blocking++;
    else if (/\(nice-to-have\)/i.test(l)) niceToHave++;
  }
  return { blocking, niceToHave };
}

function MissingInfoCallout({ memo, onRedraft, disabled }: { memo: string; onRedraft: () => void; disabled: boolean }) {
  const { blocking, niceToHave } = countMissingInfo(memo);
  const total = blocking + niceToHave;
  if (total === 0) return null;
  const bg = blocking > 0 ? "#FFFAF2" : "#FBFBFC";
  const border = blocking > 0 ? "#FADCB4" : "#E7E8EC";
  const iconColor = blocking > 0 ? "#B45309" : "#5A6069";
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: iconColor }} />
        <span className="kicker" style={{ color: iconColor }}>
          {blocking > 0 ? `${blocking} blocking gap${blocking === 1 ? "" : "s"}` : `${niceToHave} nice-to-have gap${niceToHave === 1 ? "" : "s"}`}
          {blocking > 0 && niceToHave > 0 ? ` · ${niceToHave} nice-to-have` : ""}
        </span>
      </div>
      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>
        The AI listed things it couldn't answer from the source docs. Type your answers directly into the memo below — right under each question, or next to any gap — and click <strong>↻ Re-draft with your answers</strong>. The model will read your edits and incorporate them.
      </p>
      <button
        type="button"
        onClick={onRedraft}
        disabled={disabled}
        style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "var(--white)", background: iconColor, border: "none", padding: "6px 10px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        ↻ Re-draft with your answers
      </button>
    </div>
  );
}
