"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VisibilityMarker } from "@/components/VisibilityMarker";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: "client_visible" | "internal";
  assignee: { name: string; type: "wahala" | "client" | "ai" } | null;
};
type Person = { id: string; name: string; type: "wahala" | "client" };

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: "#f1f2f4", text: "#4b5159", label: "To do" },
  in_progress: { bg: "#fcefdc", text: "#b45309", label: "In progress" },
  blocked: { bg: "#fbe3e3", text: "#b91c1c", label: "Blocked" },
  done: { bg: "#dcf5e3", text: "#15803d", label: "Done" },
  cancelled: { bg: "#f1f2f4", text: "#9aa0aa", label: "Cancelled" },
};
const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"];

const GRID = "1fr 150px 148px 132px";

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.todo;
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

const input: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
  background: "var(--white)",
};

export function TasksClient({
  tasks,
  assignable,
  stageId,
  canManage,
}: {
  tasks: Task[];
  assignable: Person[];
  stageId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("client_visible");
  const [assignee, setAssignee] = useState("");

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stageId, title: title.trim(), visibility, assigneeUserId: assignee || undefined }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
      } else {
        setTitle("");
        setAssignee("");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(taskId: string, status: string) {
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
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
      {tasks.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>No tasks yet.</p>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "9px 14px",
              background: "var(--surface-soft)",
              borderBottom: "1px solid var(--border-soft)",
            }}
            className="kicker"
          >
            <span>Task</span>
            <span>Assignee</span>
            <span>Status</span>
            <span>Visibility</span>
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                alignItems: "center",
                padding: "12px 14px",
                borderTop: "1px solid var(--border-soft)",
                background: t.visibility === "internal" ? "var(--surface-soft-2)" : "var(--white)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                {t.description && (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.description}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, minWidth: 0 }}>
                {t.assignee ? (
                  <>
                    {t.assignee.name}
                    {t.assignee.type === "client" && (
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: "var(--cobalt-text)", background: "var(--cobalt-wash)", borderRadius: 999, padding: "1px 6px" }}>
                        client
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "var(--muted-line)" }}>—</span>
                )}
              </div>
              <div>
                {canManage ? (
                  <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} style={{ ...input, padding: "6px 8px", fontSize: 13 }}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_STYLE[s].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <StatusPill status={t.status} />
                )}
              </div>
              <div>
                <VisibilityMarker visibility={t.visibility} />
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form onSubmit={addTask} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <input
            style={{ ...input, flex: 1, minWidth: 180 }}
            placeholder="New task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <select style={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {assignable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.type === "client" ? " (client)" : ""}
              </option>
            ))}
          </select>
          <select style={input} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="client_visible">Client-visible</option>
            <option value="internal">Internal only</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            style={{ border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, background: "var(--ink)", color: "var(--white)", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Adding…" : "Add task"}
          </button>
        </form>
      )}
      {error && <p style={{ color: "#b00020", fontSize: 13, marginTop: 8, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
