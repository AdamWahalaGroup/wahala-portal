"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid #ccc",
  borderRadius: 8,
  boxSizing: "border-box",
};

/** Create a project under an org (staff/owner). POSTs to /api/projects. */
export function CreateProjectForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(orgs[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, name: name.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Failed (${res.status}).`);
      } else {
        setName("");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (orgs.length === 0) return null;

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", maxWidth: 560 }}>
      <select style={{ ...input, width: "auto" }} value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input style={{ ...input, width: "auto", flex: 1, minWidth: 180 }} placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} required />
      <button
        type="submit"
        disabled={busy}
        style={{ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, background: "#111", color: "#fff", cursor: busy ? "default" : "pointer" }}
      >
        {busy ? "Creating…" : "Create project"}
      </button>
      {error && <p style={{ color: "#b00020", fontSize: 14, width: "100%", margin: 0 }}>{error}</p>}
    </form>
  );
}
