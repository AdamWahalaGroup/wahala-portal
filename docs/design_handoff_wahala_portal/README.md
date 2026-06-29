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
- **Projects list (note the alignment fix):** each row is a CSS grid
  `grid-template-columns: 1fr 132px 142px 16px`, `align-items:center`, with
  StatusBadge and WaitingOn chips `justify-self:start` so they align in columns
  down the list regardless of label width. Trailing `›` chevron.

### 04 — Project detail (`/dashboard/projects/:id`)
- **Purpose:** One project: people + roster + the stage list.
- **Layout:** breadcrumb (mono), title + status badge, description, `WORK TYPE`
  meta. People row: Account owner card + Lead engineer card + roster avatar stack.
- **Stages list:** numbered rows (`01`…), name + sub-meta, StatusBadge, right-
  aligned tabular amount, chevron. The active stage row uses the active-row
  highlight. Staff/owner see a **+ New stage** button.

### 05 — Stage detail (`/dashboard/stages/:id`) — THE KEY SCREEN
- **Purpose:** Everything about one stage; where quote→approve→pay→deliver→accept
  happens. Make current state and the single most likely next action unmistakable.
- **Layout:** top bar (breadcrumb + **"Viewing as · {role}"** chip) over a 2-col
  grid: main (1fr) + 372px right rail, divided by a border.
- **Main:** title + StatusBadge; **Stepper**; a celebrated **Paid banner**
  (`#E1F4F9`/`#B9E3EE`, ✓ in `#0891B2` circle, "Paid in full — work cleared to
  begin"); Scope copy; **Line items** list (each with a checkbox — the line items
  ARE the acceptance checklist) with tabular amounts; an **internal-only** note
  ("3 internal tasks & the kickoff recording are hidden from the client").
- **Right rail:** big tabular **Stage total** + paid sub-line; **Your next action**
  card (contextual copy + Ink primary "Deliver to client" + secondary "Pause work"
  + a note that only role/state-allowed actions are shown); WaitingOn pill; People;
  **History timeline**.
- **Islands:** ActionBar, all ConfirmDialogs.

### 06 — Quote / scope builder (staff)
- **Purpose:** Build the quote = the later acceptance checklist; send (with
  over-threshold admin co-sign path).
- **Layout:** header (title + Draft badge); 2-col: editor (stage name input, scope
  textarea, reorderable line-item rows with `⠿` drag handle + description input +
  tabular amount + `✕`, dashed "+ Add line item") + 320px summary rail (total card,
  **over-threshold co-sign banner** in `#FFFAF2`/`#FADCB4` when total > $10,000,
  disabled "Send quote — awaiting co-sign", Ink "Request admin co-sign").
- **Island:** LineItemEditor (add/reorder/edit, live total, send).

### 07 — Acceptance (client) — designed for **mobile**
- **Purpose:** Formally accept a delivered stage against its line items, or request
  revision. A deliberate, logged trust moment.
- **Layout:** phone frame (390px). Delivered badge ("your acceptance needed"),
  checklist of line items (green ✓ boxes), paid total, big green **Accept delivery**
  + outlined red **Request revision**, micro-note "Acceptance is final & recorded".
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

### 11 — Messages / comms
- **Purpose:** Threaded, attributed comms flagged Waiting on you / Wahala.
- **Layout:** 300px thread list (each thread shows a waiting-on dot) + thread view
  (header with WaitingOn pill; message bubbles — Wahala left/`#F4F5F7`, client
  right/`#EEF0FE`, each with avatar + name + mono "{org} · {date time}"; composer
  with input + Ink Send).

### 12 — Client account hub
- **Purpose:** The durable home for one organization.
- **Layout:** org header (ink logo tile, name, mono "Client since … · N projects ·
  N stages", account-owner card); tab row (Overview / People / Work history /
  Files / Messages); body = work-history timeline (status-colored nodes, item =
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
  and two CTAs ("Message Ada to get started" / "Book a kickoff call"); a **What we
  do** 2×2 offerings grid; and a **Your Wahala agent** card — shows the assigned
  agent (set at invite time), states they'll reach out with next steps to scope the
  first project, and offers a **Message {agent}** action.
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
- Per-stage: status, line items, amount, payment state, history, allowed-action set.
- Optimistic UI in islands is fine, but the **server is authoritative** for state
  transitions and permissions.

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
