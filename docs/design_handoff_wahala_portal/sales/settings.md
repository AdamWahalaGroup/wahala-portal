# Admin settings · AI agents (frame 27)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 27 — Admin settings · AI agents (`/dashboard/settings`, admin only)
- Calm admin-tool aesthetic in the AppShell (Settings active). One card per **AI
  agent** (6, from `agent-config.ts`): **Project draft / SOW writer · Discovery
  analyst · Proposal writer · Task breakdown · Lead scout · Lead recon**. Each:
  label + a **`default · gpt-4o-mini`** (grey) or **`custom · gpt-4o`** (cobalt) chip,
  a description line, a **model input** (datalist suggestions), a **reasoning-effort
  select** (Off / Minimal / Low / Medium / High) — **hidden for Lead recon** (search
  model, no reasoning) — and Save. A muted **⚠ warning** notes reasoning effort is
  ignored on non-reasoning models. A dashed **"Coming to this page"** card reserves
  room for future knobs (complexity threshold, stuck-days window, probability
  anchors).

### Small updates to existing frames
- **Frame 17 (staff home):** add a one-line **Sales pipeline strip** under the two
  revenue cards ($ open · N deals · N leads to qualify · ⚠ stuck badge) linking to 21.
- **Sidebar** everywhere gains the Sales sub-nav + Settings (admin) + Files (soon).
- **Constraint:** clients NEVER see leads, deals, proposals-in-progress, internal
  tasks, or the dump. The **only** prospect-facing sales surface is frame 26.
