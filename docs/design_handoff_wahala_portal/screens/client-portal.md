# Client-facing screens

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

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
