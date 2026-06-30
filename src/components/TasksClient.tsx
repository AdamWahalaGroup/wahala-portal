"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VisibilityMarker } from "@/components/VisibilityMarker";

type Subtask = { id: string; title: string; done: boolean };
type Note = { id: string; author: string; body: string; createdAt: string | Date };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: "client_visible" | "internal";
  assignee: { name: string; type: "wahala" | "client" | "ai" } | null;
  deliverableId: string | null;
  subtasks: Subtask[];
  notes: Note[];
};
type Person = { id: string; name: string; type: "wahala" | "client" };
type Deliverable = { id: string; description: string };

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: "#f1f2f4", text: "#4b5159", label: "To do" },
  in_progress: { bg: "#fcefdc", text: "#b45309", label: "In progress" },
  blocked: { bg: "#fbe3e3", text: "#b91c1c", label: "Blocked" },
  done: { bg: "#dcf5e3", text: "#15803d", label: "Done" },
  cancelled: { bg: "#f1f2f4", text: "#9aa0aa", label: "Cancelled" },
};
const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"];

const input: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
  background: "var(--white)",
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.todo;
  return (
    <span style={{ background: s.bg, color: s.text, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

/** Group tasks under their deliverable (deliverable order; null/General last). */
function groupTasks(tasks: Task[], deliverables: Deliverable[]): { id: string | null; label: string; tasks: Task[] }[] {
  const labelById = new Map(deliverables.map((d) => [d.id, d.description]));
  const order = new Map(deliverables.map((d, i) => [d.id, i] as const));
  const groups: { id: string | null; label: string; tasks: Task[] }[] = [];
  for (const t of tasks) {
    const id = t.deliverableId && labelById.has(t.deliverableId) ? t.deliverableId : null;
    let g = groups.find((x) => x.id === id);
    if (!g) {
      g = { id, label: id ? labelById.get(id)! : "General", tasks: [] };
      groups.push(g);
    }
    g.tasks.push(t);
  }
  groups.sort((a, b) => {
    if (a.id === b.id) return 0;
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
  return groups;
}

export function TasksClient({
  tasks,
  assignable,
  deliverables,
  stageId,
  canManage,
  canDelete,
}: {
  tasks: Task[];
  assignable: Person[];
  deliverables: Deliverable[];
  stageId: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("client_visible");
  const [assignee, setAssignee] = useState("");
  const [deliverable, setDeliverable] = useState("");

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stageId,
          title: title.trim(),
          visibility,
          assigneeUserId: assignee || undefined,
          stageLineItemId: deliverable || undefined,
        }),
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

  const groups = groupTasks(tasks, deliverables);

  return (
    <div>
      {tasks.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 12px" }}>No tasks yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.id ?? "_general"}>
              <div className="kicker" style={{ marginBottom: 6, color: g.id ? "var(--cobalt)" : "var(--muted)" }}>
                {g.label}
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                {g.tasks.map((t, i) => (
                  <TaskRow key={t.id} task={t} canManage={canManage} canDelete={canDelete} first={i === 0} onChanged={() => router.refresh()} setError={setError} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form onSubmit={addTask} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
          <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="New task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          {deliverables.length > 0 && (
            <select style={input} value={deliverable} onChange={(e) => setDeliverable(e.target.value)}>
              <option value="">No deliverable</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.description}
                </option>
              ))}
            </select>
          )}
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

/** One task: a header row (status/visibility) that expands to its subtasks + worklog. */
function TaskRow({
  task,
  canManage,
  canDelete,
  first,
  onChanged,
  setError,
}: {
  task: Task;
  canManage: boolean;
  canDelete: boolean;
  first: boolean;
  onChanged: () => void;
  setError: (s: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [note, setNote] = useState("");
  const doneCount = task.subtasks.filter((s) => s.done).length;

  async function call(url: string, method: string, body?: object) {
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string };
        setError(d.message ?? `Failed (${res.status}).`);
        return false;
      }
      onChanged();
      return true;
    } catch {
      setError("Network error — please try again.");
      return false;
    }
  }

  return (
    <div style={{ borderTop: first ? "none" : "1px solid var(--border-soft)", background: task.visibility === "internal" ? "var(--surface-soft-2)" : "var(--white)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-line)", fontSize: 13, flex: "none", marginTop: 2, transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}
        >
          ▶
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{task.title}</div>
          {/* Meta wraps under the title so long titles never get squeezed */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 7 }}>
            <span style={{ fontSize: 12.5, color: task.assignee ? "var(--ink-soft)" : "var(--muted-line)" }}>
              {task.assignee ? (
                <>
                  {task.assignee.name}
                  {task.assignee.type === "client" && (
                    <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 600, color: "var(--cobalt-text)", background: "var(--cobalt-wash)", borderRadius: 999, padding: "1px 6px" }}>client</span>
                  )}
                </>
              ) : (
                "Unassigned"
              )}
            </span>
            {canManage ? (
              <select
                value={task.status}
                onChange={(e) => call(`/api/tasks/${task.id}/status`, "POST", { status: e.target.value })}
                style={{ ...input, padding: "5px 8px", fontSize: 12.5 }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_STYLE[s].label}
                  </option>
                ))}
              </select>
            ) : (
              <StatusPill status={task.status} />
            )}
            <VisibilityMarker visibility={task.visibility} />
            {(task.subtasks.length > 0 || task.notes.length > 0) && (
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {task.subtasks.length > 0 && `${doneCount}/${task.subtasks.length} subtasks`}
                {task.subtasks.length > 0 && task.notes.length > 0 && " · "}
                {task.notes.length > 0 && `${task.notes.length} note${task.notes.length === 1 ? "" : "s"}`}
              </span>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={() => call(`/api/tasks/${task.id}`, "DELETE")}
            title="Delete task"
            aria-label="Delete task"
            style={{ background: "transparent", border: "none", color: "var(--muted-line)", cursor: "pointer", fontSize: 14, flex: "none", marginTop: 2 }}
          >
            🗑
          </button>
        )}
      </div>

      {open && (
        <div style={{ padding: "2px 14px 16px 48px", display: "grid", gap: 16 }}>
          {/* Subtasks */}
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Subtasks
            </div>
            {task.subtasks.length === 0 && !canManage ? (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>None.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {task.subtasks.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={s.done}
                      disabled={!canManage}
                      onChange={(e) => call(`/api/tasks/${task.id}/subtasks`, "PATCH", { subtaskId: s.id, done: e.target.checked })}
                    />
                    <span style={{ fontSize: 13.5, flex: 1, textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--muted)" : "var(--ink)" }}>
                      {s.title}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => call(`/api/tasks/${task.id}/subtasks`, "DELETE", { subtaskId: s.id })}
                        aria-label="Remove subtask"
                        style={{ background: "transparent", border: "none", color: "var(--muted-line)", cursor: "pointer", fontSize: 13 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canManage && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  style={{ ...input, flex: 1, fontSize: 13 }}
                  placeholder="Add a subtask"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && subtaskTitle.trim()) {
                      e.preventDefault();
                      call(`/api/tasks/${task.id}/subtasks`, "POST", { title: subtaskTitle.trim() }).then((ok) => ok && setSubtaskTitle(""));
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Notes / worklog */}
          <div>
            <div className="kicker" style={{ marginBottom: 6 }}>
              Notes — what was done
            </div>
            {task.notes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>No notes yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {task.notes.map((n) => (
                  <div key={n.id} style={{ fontSize: 13.5 }}>
                    <span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                      — {n.author}, {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canManage && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  style={{ ...input, flex: 1, fontSize: 13 }}
                  placeholder="Record what was done…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && note.trim()) {
                      e.preventDefault();
                      call(`/api/tasks/${task.id}/notes`, "POST", { body: note.trim() }).then((ok) => ok && setNote(""));
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
