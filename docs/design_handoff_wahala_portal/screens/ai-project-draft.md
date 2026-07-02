# Draft a project with AI (frames 18–20)

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

### 18–20 — Draft a project with AI (`/dashboard/projects/new?ai=1`)
**Goal:** staff feed the AI a proposal / SOW / meeting notes (PDF, Word, .txt/.md,
images of handwritten or whiteboard notes, or pasted text) and it **drafts a whole
project** — name, description, work type, stages, deliverables grouped by epic, and
a first message to the client — for the staffer to **edit inline and approve**.
Nothing is created until they press Create. Entry point = a **"Draft with AI"**
button beside "New project" on the Projects page (frame 16) — white, 1px cobalt
`#C9D0FB` border, cobalt `#2536C4` text, ◆ glyph. ("New project" alone = blank
flow.) The ◆ cobalt diamond is the **"Wahala AI" mark** throughout.

**What the AI infers (by explicit decision):** project name + description + work
type, **stages**, **deliverables per stage grouped by epic**, and a **first-draft
client message**. It does **NOT** guess prices and does **NOT** auto-match the
client — the staffer picks the client up front and sets stage prices later.

**Cost posture (the "don't break the bank" requirement):** drafting runs on a
**lightweight model** in a **single extraction+draft pass** (no agent loop). A
**subtle usage indicator** is shown to staff (a green dot + mono "≈ $0.03–0.05 per
draft" on upload; a live token/cost ticker while analyzing; a "This draft · $0.04 ·
11.8k in / 1.4k out · lightweight model" card on review). These are informational,
not gates.

#### 18 — Upload
- Centered card. **Client selector** (locked-style row, org avatar + name + ▾) —
  required first so the draft is grounded. **Dropzone** (1.5px dashed cobalt,
  `#FAFBFF`, ⤓ icon, "Drop files here, or browse", mono accepted-types line).
  **File list**: each row = colored type chip (PDF `#FDECEB`/`#C0392B`, MD
  `#EEF0FE`/`#2536C4`, JPG `#F0ECFB`/`#6D28D9`), name + mono meta ("12 pages",
  "read with vision" for images), green "ready" pill, × remove. A **paste textarea**
  ("…or paste meeting notes / an email thread"). Footer: cost note (left) +
  "Start blank instead" (ghost) and **"◆ Draft project →"** (ink) (right).
- **Islands:** dropzone + file queue + the draft trigger.

#### 19 — Analyzing (transient)
- Compact card shown while the model works: ◆ header + "Reading your documents…",
  a **step checklist** (Extracted text ✓ → Identified phases ✓ → Drafting stages &
  deliverables *(current, amber ring)* → Writing the client message + context memo),
  a cobalt progress bar, and a mono "~Ns left · Nk tokens · ≈ $0.03" line. Purely a
  loading state for the single draft call.

#### 20 — Review & edit (the centerpiece)
- Header: **"◆ Drafted by Wahala AI"** badge, "Review draft" title, mono "Meridian
  Co. · from N sources · nothing saved yet"; right = **Discard** (outline) +
  **"Create project →"** (ink). A cobalt info strip: *"Every field below is
  editable. The project, its stages, and the client message are created only when
  you press Create project."*
- **2-col grid (1fr / 360px).**
- **Left = editable draft (all real form controls):**
  - **Project name** (large bold `<input>`), **Work type** (select-style), a
    read-only "3 stages · prices set later" note, **Description** (`<textarea>`).
  - **Stages & deliverables** ("drafted from the SOW phases"): one **stage card**
    per stage = numbered tile + editable stage-name input + × remove; below,
    **deliverables grouped by epic** — cobalt mono epic subheaders, each deliverable
    a borderless bottom-ruled `<input>` (square cobalt bullet + × remove), and a
    cobalt **"+ Add deliverable"** per epic. A dashed **"+ Add stage"** button ends
    the list. (Mirrors the epic-grouped deliverables model of the stage detail /
    quote builder.)
  - **First message to the client**: editable `<textarea>` in a bordered card with a
    footer **toggle "Post to the account thread on create"** (on by default) — when
    on, the message lands in Messages (frame 11) on the new project's thread.
- **Right rail (3 cards):**
  - **`project-context.md` — the agent's memory artifact (KEY).** Dark filename bar
    (◆ + mono "project-context.md" + "Edit"); body is a **rendered-markdown preview**
    (mono, `#FBFBFC`) with sections **# title / ## Read / ## Inferred / ## Assumptions
    / ## Open questions** (open-questions heading in amber `#B45309`). Footer note:
    *"Saved with the project as the agent's memory — future AI actions start from
    this, so they stay cheap and on-context."* **Implementation:** persist this
    markdown on the project record (e.g. `projects.ai_context_md`); it is the durable
    context that lets later lightweight AI calls (status drafts, summaries, next-stage
    suggestions) run **without re-reading the source docs** — that is the
    cost-control mechanism. It is editable by staff.
  - **Sources**: the files read (type chip + name) + a "↻ Re-draft from sources"
    button (re-runs the single draft pass).
  - **Usage**: "This draft" + big `$0.04`, with "11.8k in · 1.4k out · lightweight
    model".
- **Create** writes the project + stages + deliverables, persists
  `project-context.md`, and (if the toggle is on) posts the client message to the
  account thread — all server-side in one action.
- **Islands:** the whole editable draft (field state), the message toggle, re-draft,
  and Create. Extraction/drafting is a server action; the page renders its result.
