# Admin settings · AI agents (frame 27)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 27 — Admin settings · AI agents (`/dashboard/settings`, admin only)
- Calm admin-tool aesthetic in the AppShell (Settings active). **Settings has its own
  sub-nav: AI agents · SLAs & nudges · Integrations** (frame 47) — the sub-nav
  replaces the single-page "Coming to this page" placeholder originally sketched
  here; the complexity threshold, stuck-days window, and probability anchors live on
  the **SLAs & nudges** page instead, with an inline pointer from the bottom of this
  page ("Looking for the thresholds? → SLAs & nudges").
- One card per **AI agent** (7, from `agent-config.ts`): **Project draft / SOW
  writer · Discovery analyst · Proposal writer · Task breakdown · Contact scout
  (analysis) · Lead recon (web search) · Package extractor (readiness)**. ("Contact
  scout" renamed from "Lead scout" to match the lead→contact rename in
  `CRM-RESTRUCTURE.md`; "Package extractor" is new — it reads each recorded call and
  updates the 10 `discovery_packages` fields that drive `deals.readiness_score`, see
  `TRAINING-AND-SCORECARD.md`.) Each card: label + a **`default · gpt-4o-mini`**
  (grey) or **`custom · gpt-4o`** (cobalt) chip, a description line, a **model input**
  (datalist suggestions), a **reasoning-effort select** (Off / Minimal / Low / Medium
  / High) — **hidden for Lead recon** (search model, no reasoning) — and Save. A
  muted **⚠ warning** notes reasoning effort is ignored on non-reasoning models. Each
  card also has a collapsed **▸ System prompt** disclosure.

### Small updates to existing frames
- **Frame 17 (staff home):** add a one-line **Sales pipeline strip** under the two
  revenue cards ($ open · N deals · N leads to qualify · ⚠ stuck badge) linking to 21.
- **Sidebar** everywhere gains the Sales sub-nav + Settings (admin) + Files (soon).
- **Constraint:** clients NEVER see leads, deals, proposals-in-progress, internal
  tasks, or the dump. The **only** prospect-facing sales surface is frame 26.
