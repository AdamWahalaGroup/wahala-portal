# Handoff: Wahala Portal — CRM + Client Portal

## Overview
Wahala Portal is the internal **CRM + client portal** for *Wahala Group*, a lean
services firm. One app, two audiences: **Wahala staff** running client work, and
**clients** watching that work and approving/paying for it. The product sells
accountability and clear communication — every client has a dedicated account
owner, every dollar maps to an itemized scope **paid before work begins**, every
delivery is **formally accepted**, and every action is logged.

The spine of the product is the **pay-as-you-go Stage lifecycle**. This package
covers the brand/design-system and the priority screens for the first build pass.

## About the Design Files
The file in this bundle (`Wahala Portal.dc.html`) is a **design reference created
in HTML** — a prototype showing intended look and behavior, **not production code
to copy directly**. It is a single pannable "canvas" containing 13 labeled frames
(a design-system panel + screens + a build note). The task is to **recreate these
designs in the target codebase** (Next.js App Router / React Server Components on
Cloudflare Workers — see §9 below) using its established patterns, not to ship the
HTML as-is.

Open the file in a browser and zoom/pan to inspect each frame. Frames are labeled
`01 — Foundations` through `13 — Build note`.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and component
treatments are intended to be implemented pixel-faithfully using the codebase's
own libraries. Exact tokens are in **Design Tokens** below.

---

## Stack context (§9 — so the implementation maps to live data)
- **Framework:** Next.js (App Router, **React Server Components**) on **Cloudflare
  Workers** (via OpenNext). Data in **Cloudflare D1**; **magic-link** auth; **KV**
  sessions.
- Keep the client bundle small. **Pages are server components**; only small
  interactive pieces are **client islands** (see Build Note frame 13 + the
  Server/Island table below).
- **Routes today:** `/login`, `/dashboard`, `/dashboard/projects/:id`,
  `/dashboard/stages/:id`.
- **JSON API:** `GET/POST /api/projects`, `GET/POST /api/stages`,
  `GET /api/stages/:id`, `POST /api/stages/:id/:action` where `:action` ∈
  `send_quote | approve_quote | reject_quote | mark_paid | start_work | deliver |
  accept | request_revision`.

---

## Design Tokens

### Color — base & brand
| Token | Hex | Use |
|---|---|---|
| Ink | `#16181D` | Primary text, primary buttons, sidebar bg, internal-only marker |
| Ink soft | `#3A3F47` | Secondary text |
| Muted | `#767B85` | Tertiary text / meta |
| Muted line | `#9AA0AA` | Mono labels, hints |
| Border | `#E7E8EC` / `#EDEDF1` / `#F2F3F5` | Card borders, row dividers (light→lighter) |
| Surface | `#F4F5F7` | Panels, chips |
| Surface soft | `#FBFBFC` / `#FAFAFB` | Rail/section backgrounds, internal-row tint |
| White | `#FFFFFF` | Cards |
| Cobalt (brand) | `#2B3EE6` | Brand mark facet, links, focus, lead-engineer avatar |
| Cobalt text | `#2536C4` | Brand text on light |
| Cobalt wash | `#EEF0FE` (border `#DDE1FB`) | Brand-tinted surfaces, client bubble |

> Primary action buttons are **Ink**, not cobalt — cobalt is reserved for brand
> moments, focus, and links (Stripe-style restraint).

### Color — semantic stage status (badge = soft tint bg + dark text + solid dot)
| Status | Dot / solid | Badge bg | Badge text |
|---|---|---|---|
| draft | `#6B7280` | `#F1F2F4` | `#4B5159` |
| quoted | `#2563EB` | `#E8EFFE` | `#1D4ED8` |
| approved | `#7C3AED` | `#F1EBFE` | `#6D28D9` |
| paid | `#0891B2` | `#E1F4F9` | `#0E7490` |
| in_progress | `#D97706` | `#FCEFDC` | `#B45309` |
| delivered | `#0D9488` | `#DCF3F0` | `#0F766E` |
| accepted | `#16A34A` | `#DCF5E3` | `#15803D` |
| needs_revision | `#DC2626` | `#FBE3E3` | `#B91C1C` |
| rejected | `#B91C1C` | `#F6DEDE` | `#991B1B` |

### Color — "waiting on" & visibility
- **Waiting on you:** bg `#FFF7ED`, text `#B45309`, border `#FADCB4`, dot `#EA8A0D`.
- **Waiting on Wahala:** bg `#F4F5F7`, text `#5A6069`, border `#E7E8EC`, dot `#9AA0AA`.
- **Client-visible:** bg `#EEF0FE`, text `#2536C4`.
- **Internal only:** bg `#16181D` (ink), text `#CFD2DA`, prefixed with `⊘`.

### Typography
- **Sans:** `Hanken Grotesk` (weights 400/500/600/700/800), system-ui fallback.
- **Mono:** `IBM Plex Mono` (400/500/600) — used for kicker/eyebrow labels
  (uppercase, letter-spacing ~`.12em`), IDs, breadcrumbs, timestamps, and meta.
- **Money:** Hanken Grotesk with `font-variant-numeric: tabular-nums`.
- Scale: Display 32–34/800 (`letter-spacing:-.025em`), Title 20–25/800,
  Subtitle 18–22/600, Body 14–15/400 (line-height ~1.6), Label 11/mono-caps,
  Micro 10–10.5/mono.

### Spacing, radius, elevation, focus
- **Spacing:** 4px base. Common: 8 / 10 / 14 / 18 / 22 / 30–36 (card padding).
- **Radius:** inputs & small buttons `8–9px`; cards/rows `10–12px`; outer frame
  cards `6px`; pills `999px`; modals `16px`; avatars `50%`.
- **Elevation (cards):** `0 1px 3px rgba(0,0,0,.08), 0 12px 40px -24px rgba(0,0,0,.18)`.
  Modal: `0 1px 3px rgba(0,0,0,.08), 0 24px 60px -24px rgba(0,0,0,.35)`.
- **Focus:** `2px solid #2B3EE6` border + `0 0 0 4px #EEF0FE` ring.
- **Active-row highlight:** `1.5px solid #C9D0FB` border + `0 0 0 3px #F3F5FF`.
- **Motion:** subtle only (≤150ms ease) — fades and small lifts, no flourish.

---

## Core Components (frame 01 — Foundations)
Build these as shared components first; every screen composes them.

- **StatusBadge** — the 9 statuses above. Pill: `padding:4px 11px 4px 9px`,
  `border-radius:999px`, `font:600 12.5px`, leading 7px dot. Status must be
  conveyed by **text + dot**, not color alone (WCAG AA).
- **Stepper** — the lifecycle: draft → quoted → approved → paid → in_progress →
  delivered → accepted (rejected / needs_revision are branches). 28px circles:
  completed = ink fill + white ✓; current = white + 2px status-colored border +
  `0 0 0 4px` wash ring + center dot; future = white + 1px `#D7D9DF` + grey number.
  A 2px track behind (`#E7E8EC`) with an ink progress segment to the current step.
  - **Responsive (required) — 7 labels collide on narrow screens.** Two modes
    keyed off the stepper's own width (container query, or a media query on the
    layout): **Wide (≥ ~640px):** full labeled stepper as above; nodes spaced with
    `justify-content:space-between`, each label column `min-width:0` with a small
    horizontal gap and 2-line `text-wrap` so adjacent labels never touch.
    **Narrow (< ~640px):** **drop the per-step text labels** and render just the 7
    dots + progress track, with a single caption line **"Step {n} of {total} ·
    {current state}"** (e.g. "Step 5 of 7 · In progress") above or below. This is the
    primary fix — don't shrink-to-fit all 7 labels. (Horizontal-scroll is an
    acceptable fallback but less preferred.) The compact dashboard-card stepper
    (frame 03) is effectively this narrow mode at small size.
- **ActionBar** — primary (Ink), secondary (white + `#D7D9DF` border),
  destructive (white + `#F0CACA` border + `#B91C1C` text), disabled
  (`#F1F2F4` bg, `#B4B9C1` text). **Render only the actions the server returns.**
- **Money** — tabular figures, e.g. `$8,500.00`.
- **HistoryTimeline** — actor (bold) + action, then mono `→ state · date, time`,
  with a status-colored node and connector line.
- **WaitingOn** indicator and **VisibilityMarker** (see token table).
- **PeopleCard / role chips / assignee avatars** — 30–34px circular initials.
  Account owner = ink avatar; lead engineer = cobalt avatar.
- **Lists/tables, empty states, forms + inline validation, toasts, ConfirmDialog**
  (for pay / accept / reject / send-over-threshold).

---

## Screens / Views

### 01 — Foundations
Reference only — the design-system panel (brand lockup, color, type, components).

### 02 — Login (`/login`)
- **Purpose:** Sign-in via **Google SSO** or magic-link (no passwords).
- **Layout:** Centered card, brand top-left, `h1` "Sign in", subcopy, a
  **"Continue with Google"** button (white, `#D7D9DF` border, Google glyph) at the
  top, an "or" divider, then the email field (mono uppercase label) + full-width
  Ink "Send magic link" button, footer hint.
- **States:** **idle** (form), **sent** ("Check your email", ✉ in `#EEF0FE`
  rounded square, resend), **error** (red card: "We couldn't send that link"; also
  surfaces `?error=` messages from the SSO redirect). The error is an intentional
  designed state.
- **Auth note:** a `@wahalagroup.com` Google login auto-provisions as a **Wahala
  admin** (no dedicated UI — affects which views the user lands in).
- **Island:** the email form (idle/sending/sent/error); Google button kicks the
  OAuth redirect.

### 03 — Client dashboard (`/dashboard`, client role)
- **Purpose:** Client sees what's **on them**, what's on Wahala, and their projects.
- **Layout:** 228px ink sidebar (brand, org context locked to one org, nav: Home /
  Projects / Files / Messages w/ unread badge, **Account owner card** pinned at
  bottom) + main column.
- **Main:** greeting; **"On you" section** (amber-tinted cards: Approved→Pay,
  Delivered→Review & accept, each with status badge + tabular amount + Ink CTA);
  **Your projects** list.
- **Projects list — cards with an embedded progress stepper:** each project is a
  **card** (`border:1px solid #EDEDF1`, `border-radius:13px`, padding ~16/20px),
  stacked in a flex column with `gap:12px`. Card has two parts:
  1. **Header row** (flex, `align-items:center`, `gap:14px`): project name +
     mono "{work-type} · Stage N of M" sub-line (left, `flex:1`); then **StatusBadge**;
     then a **WaitingOn chip** ("On you" amber / "On Wahala" grey); then a `›` chevron.
  2. **A compact lifecycle Stepper** (a scaled-down reuse of the frame-05 Stepper —
     see the Stepper component) on its own row beneath the header, representing
     **where the project's current stage sits** in the lifecycle. 22px nodes, 10px
     labels, the same 7 steps (Draft → Quoted → Approved → Paid → In progress →
     Delivered → Accepted): completed = ink fill + white ✓; the current/next step =
     white circle + 2px `#D97706` border + `#FCEFDC` 3px ring + inner amber dot
     (label `#16181D` weight 800); upcoming = white + 1px `#D7D9DF` border + grey
     number. A 2px progress track sits behind the nodes (`#E7E8EC` base, `#16181D`
     fill to the current node). The active step's label is shortened to the **next
     action** where natural ("Pay", "Accept") to echo the "On you" CTA.
  - Per-project states in the mock: **Mobile App** — done through Approved, active
    "Pay"; **Website Refresh** — done through Delivered, active "Accept"; **Brand
    System** — done through Paid, active "In progress".
  - (Replaces the earlier flat grid-row list; the stepper is the same component used
    full-size on the stage detail screen, frame 05.)

### 04 — Project detail (`/dashboard/projects/:id`)
- **Purpose:** One project: people + roster + the stage list.
- **Layout:** breadcrumb (mono), title + status badge, description, `WORK TYPE`
  meta. People row: Account owner card + Lead engineer card + roster avatar stack.
- **Stages list:** numbered rows (`01`…), name + sub-meta, StatusBadge, right-
  aligned tabular amount, chevron. The active stage row uses the active-row
  highlight. **+ New stage** is the prominent next action — a full-width Ink button
  *below* the stage list ("New stage — scope the next phase"), not a small header
  button. File upload is a deliberately **secondary, off-to-the-side** affordance
  (small outlined "Upload file · optional" in the section header), visibly optional.

### 16 — Projects, staff (`/dashboard/projects`) — grouped by client
- **Purpose:** A staff cross-client list of all projects, **cleanly separated by
  client** so each client's work reads as its own block.
- **Layout:** page header ("Projects · Across all your clients" + search + a
  **"Draft with AI"** button (cobalt-outline, ◆) and a primary **"+ New project"**
  button (ink `#16181D`) on the right of the header — see frames 18–20 for the AI
  flow);
  then one **client group** per org — a heading row (org avatar + name + project
  count + the assigned Wahala person on the right) with a 2px ink underline,
  followed by that client's project rows (name + work-type/stage meta +
  StatusBadge + chevron). Groups are visually distinct (heading divider + spacing)
  so clients never blur together. Respects tenant scoping (only orgs the staffer
  can see). **Note:** "New project" lives **here**, not on the staff home (frame 17).

### 17 — Staff home / admin landing (`/dashboard`, staff role) — clients & revenue
- **Purpose:** The **Wahala admin's landing page**. Deliberately **not** a project
  or stage worklist — it answers "who are my clients and where does the money
  stand." It does **NOT** show a projects list or active-stage cards (those live on
  the Projects page / stage screens).
- **Layout:** standard staff shell — 228px ink sidebar (wahala logo; **"Wahala
  Group / all clients"** org switcher; nav Home *(active)* / Clients / Projects /
  Files / Messages; **Ada Obi · "Wahala admin"** pinned bottom) + main column.
- **Main:**
  - Header: mono date + **"Good morning, {name}."**, with search + admin avatar.
  - **Two revenue summary cards** (2-col): **"Collected to date"** (green-tinted,
    `#F4FBF7`/`#D6EFE4`, green dot) showing total **accepted & paid** (`$27,700`,
    sub "Across N clients · accepted & paid"); and **"Promised on completion"**
    (amber-tinted, `#FFFAF2`/`#FADCB4`, amber dot) showing total **in-flight +
    approved-quote value invoiced as stages complete** (`$32,100`, sub "In-flight +
    approved quotes · invoiced as stages complete"). Big numbers are mono/tnum
    32px 800.
  - **Clients table**: header row ("Clients" + "N active"); a column-label row
    (Client / Paid to date / Promised — last two right-aligned mono uppercase);
    then one row per client = org avatar tile + name + mono "N projects · owner
    {name}" sub-line, **Paid to date** (ink mono/tnum, greyed `$0` if none),
    **Promised** (amber mono/tnum), chevron. Rows clickable → that client's account
    hub (frame 12).
- **Definitions for the developer:**
  - **Paid to date** = sum of stages with status **accepted & paid** for that
    client (lifetime collected).
  - **Promised** = sum of **in-progress** stages + **approved/quoted** stages not
    yet paid — i.e. committed value that will be invoiced as those stages complete.
  - Summary-card totals are the column sums across all visible (tenant-scoped)
    clients.
- **Islands:** none required (static, server-rendered) beyond the org switcher.

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

### 05 — Stage detail (`/dashboard/stages/:id`) — THE KEY SCREEN
- **Purpose:** Everything about one stage; where quote→approve→pay→deliver→accept
  happens. Make current state and the single most likely next action unmistakable.
- **Layout:** top bar (breadcrumb + **"Viewing as · {role}"** chip) over a 2-col
  grid: main (1fr) + 372px right rail, divided by a border.
- **Main:** title + StatusBadge; **Stepper**; a celebrated **Paid banner**
  (`#E1F4F9`/`#B9E3EE`, ✓ in `#0891B2` circle, "Paid in full — work cleared to
  begin"); Scope copy; **Deliverables** list **grouped by epic** (cobalt epic
  subheaders; each deliverable has the accept ✓ checkbox and its description —
  the stage is one fixed price — **per-deliverable prices and estimate notes are
  hidden for now**, deliverable rows show description only); a **Tasks** section (internal delivery) where tasks
  are **grouped under their deliverable** and each row is **expandable** to reveal a
  **subtask checklist** + a **notes worklog** (attributed + dated, inline add for
  staff) — collapsed header shows "{done}/{n} subtasks · {n} notes"; a **Changes**
  section (change orders — see below); and the **internal-only** note (tasks/
  subtasks/notes are staff-only unless a task is client-visible).
- **Changes (change orders):** a **+ Request a change** button (client + staff)
  opens a name + detail form; each change card shows a status pill —
  **Requested → Quoted → Approved → Paid → Applied** (or **Declined**) — a price (or
  "no price yet" / "$0 absorb"), and role-appropriate buttons (staff: Send quote w/
  inline `$`, "$0 — absorb", Decline, Apply; client: Approve / Reject; admin: Mark
  paid). Change orders run their own approve→pay gate before being applied to scope.
- **Right rail:** big tabular **Stage price** (fixed) + paid sub-line; **Your next
  action** card (contextual copy + Ink primary, e.g. "Deliver to client" / staff-
  draft "Edit quote" / client-delivered green "Review & accept" → frame 07; only
  role/state-allowed actions shown); WaitingOn pill; People; **History timeline**.
- **Islands:** ActionBar, ConfirmDialogs, expandable Task rows (subtasks + notes),
  Changes section.

### 06 — Quote / scope builder (staff)
- **Purpose:** Set a stage's **fixed price** and its **deliverables** (grouped by
  epic); send (with over-threshold admin co-sign path). The deliverables become the
  later acceptance checklist.
- **Layout:** header (title + Draft badge); 2-col: editor + 320px summary rail.
  **Editor is epic-grouped:** each **epic** is a card with an editable epic-name
  header, then its **deliverable** rows under it (drag handle · description · `✕`);
  an **+ Add deliverable** button inside each epic lets the admin add deliverables
  one after another without re-entering the epic; an **+ Add epic** button at the
  bottom starts a new epic group with its own deliverables. **No per-deliverable
  price or estimate-note inputs** — only the description. The rail has a big
  editable **Stage price · fixed** `$` field (hint: "{N} epics · {N} deliverables ·
  the client pays this one fixed price"), the **over-threshold co-sign banner** in
  `#FFFAF2`/`#FADCB4` when price > $10,000, disabled "Send quote — awaiting
  co-sign", Ink "Request admin co-sign".
- **Island:** ScopeBuilder (add/reorder epics + deliverables, fixed price, send).

### 07 — Acceptance (client) — designed for **mobile**
- **Purpose:** Formally accept a delivered stage against its deliverables, or
  request revision. A deliberate, logged trust moment.
- **Layout:** phone frame (390px). Delivered badge ("your acceptance needed"),
  **checklist of deliverables grouped by epic** (green ✓ boxes), paid total, big
  green **Accept delivery** + outlined red **Request revision**, micro-note
  "Acceptance is final & recorded".
- **Confirm dialog:** weighty modal — green check tile, "Accept this delivery?",
  body naming the items + that it's logged as accepted by *you* on the date,
  Cancel + green "Yes, accept". Plus a **Request revision** variant with a note
  textarea.
- **Islands:** AcceptanceChecklist + ConfirmDialog.

### 08 — Payment hand-off (client)
- **Purpose:** From an `approved` stage → Stripe **hosted checkout**, and the
  success/return state that flips the stage to `paid`.
- **Layout:** two cards — (1) **Pay to begin work**: Approved badge, line summary,
  total, Ink "Continue to secure checkout", lock note "processed by Stripe, Wahala
  never sees your card"; (2) **Payment received** success: Paid badge, celebrated
  ✓ tile, amount, "View stage" / "Receipt", logged footer.
- **Island:** the pay button (initiates Stripe Checkout); success is a return route.

### 09 — Tasks (delivery)
- **Purpose:** A stage's tasks with status + assignee; client "on you" items;
  **internal tasks hidden from clients**; engineers see only assigned work.
- **Layout:** header (title + "Staff view" chip + "+ Task"); table grid
  `1fr 150px 150px 130px` — Task / Assignee (avatar + name) / Status pill /
  Visibility. Internal rows get the `#FAFAFB` tint + `⊘ Internal` marker
  (recording, cost & margin). A footer note restates the visibility rule.

### 10 — Files / assets
- **Purpose:** Upload + list, each carrying a visibility flag.
- **Layout:** dashed upload dropzone ("New uploads default to client-visible"),
  then file rows: colored type tile (mono `PDF`/`FIG`…) + name + mono meta
  (size · uploader · date) + VisibilityMarker. Internal files (`recording.mp4`,
  `AI-meeting-digest.md`) get the `⊘ Internal only` marker + tinted row.

### 11 — Messages / comms (`/dashboard/messages`)
- **Purpose:** Threaded, attributed comms organized as a **company → project
  hierarchy**. The thread list is a tree: each **client org (company / "Account"
  level)** is a top-level group, with its **projects nested and indented
  underneath**. Selecting a level sets the scope:
  - **Company / Account level** → opens an **account-wide thread that spans every
    project** for that org (the durable client↔Wahala line, exists before any
    project).
  - **Project level** → scopes the view to **just that project's messages**.
  - Staff (admin) see **multiple companies** in the list (each its own collapsible
    group). A client sees **only their own company** at top with their projects
    nested under it — same tree, single root.
- **Layout:** 300px thread list. Company rows: disclosure caret (`▾`/`▸`), a small
  ink avatar tile (initial), bold org name, cobalt **"Account"** tag (`#2536C4` on
  `#EEF0FE`), right-aligned waiting-on chip; sub-line "Account-wide thread · spans N
  projects" (indented under the name). Project rows are **indented (`padding-left`
  ~34px) with a `border-left:3px` selection rail** (`#16181D` + `#FBFBFC` bg when
  active): small square status dot, project name, grey **"Project"** tag (`#5A6069`
  on `#F1F2F4`), waiting-on chip; mono "{stage} · Stage N" sub-line; last-message
  snippet. A filter-chip row sits under the "Threads" heading: **All / Waiting on
  you / Unread** (active chip = `#16181D` on `#F1F2F4`). Company groups are
  separated by a hairline top border.
- **Thread view:** header shows a **breadcrumb reflecting the selected level** —
  e.g. greyed `Meridian Co. ›` + bold `Mobile App` for a project, or just the org
  name for the account level — with a mono scope caption ("Project thread · N
  stages · this view is scoped to {project}" vs an account-wide caption). A
  **viewer-aware WaitingOn pill** ("Waiting on you" amber vs "Waiting on Wahala /
  the client" grey, phrased for the viewer). Message bubbles — Wahala
  left/`#F4F5F7`, client right/`#EEF0FE`, each with avatar + name + mono "{org} ·
  {date time}". A **composer** (textarea + Ink Send, a "Needs a reply from {them}"
  checkbox that flags the thread, ⌘/Ctrl-Enter to send).
- **Behavior:** account-level (company) threads aggregate / are filterable across
  all of that org's projects; project-level threads filter to a single project.
  The same filter chips apply at whatever level is selected.
- **Islands:** thread tree (expand/collapse + selection) + thread view + composer.

### 12 — Client account hub
- **Purpose:** The durable home for one organization.
- **Layout:** org header (ink logo tile, name, mono "Client since … · N projects ·
  N stages", account-owner card); tab row (Overview / Work history / People /
  Files *soon* / Messages *soon*); body = work-history timeline (status-colored nodes, item =
  project·stage, mono "Accepted · date · $amount") + side cards (Lifetime totals,
  People with client roles).

### 13 — Build note
Reference only — the Server/Island mapping below, rendered visually.

### 14 — Clients · staff onboarding (`/dashboard/clients`)
- **Purpose:** Staff-only. An admin onboards a prospect, captures intake, and
  invites them in; tracks each client **Invited → Accepted**.
- **Layout:** staff ink sidebar (note the **org switcher** "Wahala Group · all
  clients" and a **Clients** nav item) + main column.
- **Main:** header ("Clients" + subcopy) with an Ink **+ Onboard client** button;
  a status filter row (All / Invited / Accepted with counts); a **clients table**
  (grid `1fr 150px 110px 30px 16px`: company w/ avatar + email, primary contact,
  status pill — Accepted = green, Invited = amber/"waiting"-style, a **delete**
  (trash) action, chevron); and a right **Onboard a client** panel (Company,
  Primary contact + Email, **Intake notes — "what they're looking for"** textarea,
  an **Assigned agent** selector (defaults to the inviting Wahala user; can be
  reassigned to any other Wahala employee who'll own the relationship), Ink
  **Invite client** button that sends a magic-link invite, with a note that they
  show as *Invited* until they accept).
- **Delete client (frame 14b):** each row has an admin-only **delete** action that
  opens a **destructive confirm modal** (red trash tile, "Delete this client?",
  copy warning it removes the org + all projects/stages/history, an optional
  type-the-company-name guard, Cancel + red "Delete client"). Primary use: an admin
  resetting test data so they can re-create the same client/org and re-run the full
  flow. *The type-to-confirm guard is optional — drop it if it slows down repeated
  testing.*
- **Islands:** the onboard form (create + invite), the status filter, the delete
  confirm.
- **API:** `POST /api/clients` (create + invite, incl. `assignedAgentId`),
  `PATCH /api/clients/:id` (reassign agent), `DELETE /api/clients/:id`
  (cascade-delete org + children; admin-only).
- **Constraint:** staff-only screen; respects tenant isolation (this is the
  pre-org, staff-side view). Partially covers the staff "see your clients" need
  until the full **account hub (frame 12)** ships.

### 15 — Client welcome / empty state (`/dashboard`, client with no projects)
- **Purpose:** What a client lands on right after **accepting their invite**, before
  any project exists. Replaces the bare "Good afternoon, {name}" page with a warm
  welcome + a promo of Wahala Group's services, and a clear first step.
- **Layout:** the client shell (ink sidebar, org context, account-owner pinned) +
  main column. Main = greeting; a dark **hero card** (cobalt-facet accents) —
  eyebrow "Welcome to Wahala Portal", headline "We build it, run it, and remove the
  wahala", a paragraph on the firm + the pay-per-stage / formal-acceptance promise,
  and a bold closing line ("Your Wahala representative is {agent}. {agent} will
  contact you shortly to get started on your project.") — no CTAs in the hero); a **What we
  do** 2×2 offerings grid; and a **Your Wahala agent** card — shows the assigned
  agent (set at invite time), states they'll reach out with next steps to scope the
  first project, and offers a **Message {agent}** action that **opens the in-app
  Account thread** (frame 11), not an email client. The hero has no CTAs — it ends
  with a bold line "Your Wahala representative is {agent}. {agent} will contact you
  shortly to get started on your project."
- **Offerings (the four cards):** (1) **Build & ship** — websites, services, apps,
  delivered stage by stage; (2) **Custom AI, tuned to you** — bespoke models &
  pipelines, minimal hallucinations, learns the business over time; (3) **Hosting &
  maintenance** — hosting + upkeep stay on Wahala; (4) **Grow on your terms** —
  clean hand-off to the client's own dev team as they scale.
- **Note:** purely promotional/empty-state — no project data. Once the client has
  ≥1 project, this is replaced by the normal client dashboard (frame 03). All work
  is created by Wahala staff; the client never authors projects/tasks here.
- **Type:** RSC (static, no island).

---

## Server Component vs Client Island
| Component | Type |
|---|---|
| StatusBadge, Stepper, Money, HistoryTimeline | **server** |
| WaitingOn, VisibilityMarker, PeopleCard | **server** |
| ActionBar (the allowed-action set) | **island** |
| ConfirmDialog (pay / accept / reject / co-sign) | **island** |
| LineItemEditor (quote builder) | **island** |
| AcceptanceChecklist, FileUpload, MessageComposer | **island** |

Pages (`/login`, `/dashboard`, `/dashboard/projects/:id`,
`/dashboard/stages/:id`) are **RSC**: they fetch from D1, compute the action set,
and stream HTML. Islands render only what they're handed.

---

## Interactions & Behavior
- **Stage lifecycle (state machine):** `draft → quoted → approved → paid →
  in_progress → delivered → accepted`. Branches: `quoted → rejected → (re-draft)
  draft`; `delivered → needs_revision → in_progress`.
- **Action set is server-computed** from role + state (+ threshold). The UI renders
  exactly that set — never invent or client-side-gate actions.
- **Confirm steps** required for weighty actions: pay, accept, reject, request
  revision, send-over-threshold.
- **Responsive:** staff screens are desktop/data-dense; the client
  approve/pay/accept flows must be excellent on a **phone** (see frame 07).
- **States to implement per screen:** idle, loading, empty, error, and
  **no-permission**, plus role variants (staff vs each client role).

## State Management
- Auth/session (magic-link, KV) → current user + role.
- Current org (clients locked to one; staff may switch).
- Per-stage: status, **deliverables (grouped by epic)**, fixed price, payment state,
  **tasks → subtasks + notes worklog**, **change orders** (own status), history,
  allowed-action set.
- Optimistic UI in islands is fine, but the **server is authoritative** for state
  transitions and permissions.
- **Auto-refresh (behavioral):** Clients, stage, dashboard, and Messages views poll
  ~8s while something is pending (e.g. an invite outstanding) so cross-session
  changes appear live — no manual refresh, no dedicated visual.

## Vocabulary (use consistently across the UI)
- **Stage** = a fixed-price phase (paid before work). **Deliverable** = a client-
  facing scope item (renamed from "line item"; amount optional/illustrative).
  Deliverables group under **Epics**. Internal **Tasks** hang under a deliverable
  and carry **Subtasks** (checklist) + **Notes** (worklog). A **Change order** is
  the client's/staff's "request a change" object with its own
  Requested→Quoted→Approved→Paid→Applied (or Declined) gate.
- **Not yet built:** milestone billing (deposit + per-phase payment) is a future
  phase — today a stage is still "pay in full before work" (admin "Mark paid").
  Don't design final billing UI around the old per-line model.

## Non-negotiable functional constraints (§7)
1. **Role + state gating** — render only allowed actions (server returns the set).
2. **Pay-gate is a wall** — never show start/deliver on an unpaid stage; make
   **Paid** a clear, almost-celebrated threshold.
3. **Threshold co-sign** — quotes over a configurable $ require a **Wahala admin**
   to send; surface "needs admin co-sign".
4. **Visibility** — clients must **never** see internal-only items (recordings, AI
   digests, internal tasks/notes, cost/margin).
5. **Tenant isolation** — a client sees only their own org's data.
6. **Formal, logged acceptance** — deliberate, recorded (confirm dialog).
7. **Accountability first-class** — history ("who did what, when") and
   "waiting on whom" stay visible, not buried.

## Accessibility
WCAG **AA** contrast; full keyboard nav; visible focus (cobalt ring); semantic
structure; status conveyed by **more than color** (always text + dot/icon).

## Assets
- **Fonts:** Hanken Grotesk + IBM Plex Mono (Google Fonts).
- **Logo:** the wordmark "wahala" + a mark = ink rounded square containing a
  rotated (45°) cobalt diamond. No raster assets — reproduce in code/SVG.
- No third-party images; file thumbnails are colored type tiles. There are striped
  placeholders nowhere in this set (all content is real UI).

## Files
- `Wahala Portal.dc.html` — the full design canvas (all 13 frames). Open in a
  browser; zoom out to see everything, zoom in per frame for exact treatments.
