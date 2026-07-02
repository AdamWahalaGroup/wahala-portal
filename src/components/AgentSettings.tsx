"use client";

/**
 * Per-agent AI settings rows: model (free text with common suggestions), reasoning
 * effort, and the agent's system prompt (editable; matching the code default = no
 * override). Saves take effect on the agent's next run — no redeploy.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

type AgentView = {
  key: string;
  label: string;
  description: string;
  supportsReasoning: boolean;
  defaultModel: string;
  model: string;
  reasoningEffort: string | null;
  overridden: boolean;
  systemPrompt: string;
  defaultPrompt: string;
  promptOverridden: boolean;
};

const COMMON_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-5-mini",
  "gpt-5",
  "o4-mini",
];
const SEARCH_MODELS = ["gpt-4o-mini-search-preview", "gpt-4o-search-preview"];

const inputStyle: React.CSSProperties = {
  border: "1px solid #d7d9df",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  background: "var(--white)",
  boxSizing: "border-box",
};

function AgentRow({ agent }: { agent: AgentView }) {
  const router = useRouter();
  // Show the override (if any) in the input; empty = running on the env default.
  const [model, setModel] = useState(agent.overridden && agent.model !== agent.defaultModel ? agent.model : agent.overridden ? agent.model : "");
  const [effort, setEffort] = useState(agent.reasoningEffort ?? "");
  const [prompt, setPrompt] = useState(agent.systemPrompt);
  const [promptOpen, setPromptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptDirty = prompt.trim() !== agent.defaultPrompt.trim();

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/agents", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentKey: agent.key, model, reasoningEffort: effort, systemPrompt: prompt }),
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

  const listId = `models-${agent.key}`;
  const suggestions = agent.key === "lead_recon" ? SEARCH_MODELS : COMMON_MODELS;

  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-.01em" }}>{agent.label}</span>
        <span className="kicker" style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 5, background: agent.overridden ? "#F0ECFB" : "var(--surface-soft)", color: agent.overridden ? "#6D28D9" : "var(--muted)" }}>
          {agent.overridden ? `custom · ${agent.model}` : `default · ${agent.defaultModel}`}
        </span>
        {agent.promptOverridden && (
          <span className="kicker" style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 5, background: "#FCEFDC", color: "#B45309" }}>
            custom prompt
          </span>
        )}
      </div>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--muted)" }}>{agent.description}</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px" }}>
          <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Model (blank = default: {agent.defaultModel})</div>
          <input
            style={{ ...inputStyle, width: "100%" }}
            list={listId}
            placeholder={agent.defaultModel}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id={listId}>
            {suggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        {agent.supportsReasoning && (
          <div style={{ flex: "0 1 190px" }}>
            <div className="kicker" style={{ fontSize: 9, marginBottom: 4 }}>Reasoning effort</div>
            <select style={{ ...inputStyle, width: "100%" }} value={effort} onChange={(e) => setEffort(e.target.value)}>
              <option value="">Off (non-reasoning model)</option>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        )}
        <button
          onClick={save}
          disabled={busy}
          style={{
            background: "var(--ink)",
            color: "var(--white)",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            flex: "none",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ color: "#15803d", fontSize: 13, fontWeight: 600 }}>Saved ✓ — next run uses it</span>}
        {error && <span style={{ color: "#b00020", fontSize: 13 }}>{error}</span>}
      </div>
      {agent.supportsReasoning && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
          Reasoning effort only works on reasoning models (gpt-5 family, o-series). Setting it with a
          non-reasoning model makes that agent&apos;s runs fail with a clear error until you switch it off.
        </p>
      )}

      {/* System prompt — editable; text identical to the default = no override */}
      <div style={{ marginTop: 12, borderTop: "1px solid var(--surface)", paddingTop: 10 }}>
        <button
          onClick={() => setPromptOpen((v) => !v)}
          style={{ border: 0, background: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--cobalt-text)" }}
        >
          {promptOpen ? "▾ System prompt" : "▸ System prompt"}
          {promptDirty && !promptOpen ? "  (customized)" : ""}
        </button>
        {promptOpen && (
          <div style={{ marginTop: 8 }}>
            <textarea
              className="mono"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={16}
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${promptDirty ? "#FADCB4" : "#d7d9df"}`,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11.5,
                lineHeight: 1.55,
                background: "var(--white)",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 10.5, color: promptDirty ? "#B45309" : "var(--muted-line)" }}>
                {promptDirty ? "edited — Save to apply as a custom prompt" : "matches the built-in default"}
                {" · "}
                {prompt.length.toLocaleString()} chars
              </span>
              {promptDirty && (
                <button
                  onClick={() => setPrompt(agent.defaultPrompt)}
                  style={{ border: "1px solid #d7d9df", background: "var(--white)", borderRadius: 7, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: "var(--ink-soft)" }}
                >
                  Reset to default
                </button>
              )}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--muted)" }}>
              This is the agent&apos;s whole system prompt — required output sections and grounding rules live
              in here, so edit surgically and keep them intact. The no-pricing rule has a code backstop
              (sends are scanned for dollar figures), but everything else relies on this text. Reset to
              default gets you back to the shipped prompt any time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentSettings({ agents }: { agents: AgentView[] }) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
      {agents.map((a) => (
        <AgentRow key={a.key} agent={a} />
      ))}
    </div>
  );
}
