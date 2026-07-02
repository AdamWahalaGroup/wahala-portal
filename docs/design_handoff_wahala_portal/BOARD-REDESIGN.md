# Handoff: Sales Board — kanban redesign

## Overview
This handoff covers a redesign of the **Sales → Board** screen (`/dashboard/sales`)
in the Wahala Portal, plus small copy/navigation alignments on two adjacent screens
(**Leads**, **Deal room**). The goal: make the pipeline read the way a salesperson
actually works — a left→right kanban where unsorted leads enter on the left and won
deals exit on the right — so the workflow is self-evident with zero instruction.

**What changed, in one line each:**
1. The Board is now a **true kanban** (7 columns), not a stacked list of stage sections.
2. The old **"New leads to qualify" strip is removed** from the Board — leads were
   duplicated from the Leads page. Instead, **column 1 of the board IS the lead inbox**
   ("Triage"). Qualifying a lead = dragging its card right into Discovery.
3. The old stacked-list layout **survives as a "List" view** toggle (▦ Board / ☰ List)
   for a dense readout.
4. The 4 stat cards on the Board collapse into **one condensed summary strip** (the
   per-stage $ and counts now live in each column header). The List view keeps the 4 cards.
5. **Won / Lost** become dashed **drop zones** below the columns.
6. **One-surface navigation model** (frame `29`, canonical): the Board is the ONLY sales
   destination. The Board/Leads/Proposals sub-nav is REMOVED; lead workspace, deal room,
   and proposal editor open as a right-side **drawer over the board** (deep-linkable).
   The old Leads/Proposals pages become **filter chips** on the board.
7. **Leads** page content is absorbed: its "To qualify" list = the Triage column; its
   workspace = the lead drawer. "Qualify" ≡ "drag right into Discovery".
8. **Deal room** becomes the deal drawer's content (tabs: Overview · Proposal · Contract ·
   History). Its route now renders as a drawer over the board.

## About the design files
The file in this bundle (`Wahala Portal.dc.html`) is a **design reference created in
HTML** — a prototype showing intended look and behavior, not production code to paste in.
The task is to **recreate these designs in the existing Wahala Portal codebase** using its
established patterns. Per the design system notes, the real stack is **Next.js (App Router,
React Server Components) on Cloudflare Workers, D1 database, magic-link auth**. Pages are
server components; only small interactive pieces are client islands — the **kanban board
(drag-and-drop) is a client island**.

The relevant frames on the canvas are:
- **`21 — Board · kanban (canonical)`** (id `21a`) — the new default Board.
- **`21 · List toggle`** (id `21b`) — the ☰ List view.
- **`21c — Board · card peek`** — click-a-card popover.
- **`29 — Sales flow · one surface (canonical)`** — the navigation model + the drawer.
- **`28 — Admin settings · SLAs & nudges`** — admin thresholds.
- **`21 — retired`** — the OLD design, dimmed, kept only for reference. **Do not build this.**
- **`22 — Leads · triage`** / **`24 — Deal room`** — pre-existing frames; their CONTENT is
  reused inside the drawer, but they are no longer separate destinations.

## Fidelity
**High-fidelity.** Exact colors, typography, spacing, and radii are specified below and
match `src/lib/theme.ts`. Recreate pixel-accurately using existing components.

---

## Screen: Board (kanban) — `/dashboard/sales`, staff

### Layout
- Full **AppShell**: dark ink sidebar (228px) + main content on `#FBFBFC`.
- Sidebar: **Sales is a single active item (cobalt pill) with the lead-count badge — NO
  Board/Leads/Proposals sub-nav** (removed in the one-surface model, frame `29`).
- Main padding `26px 30px 30px`.
- **Header row** (flex, space-between, align flex-end):
  - Left: mono kicker "Sales" (`#9AA0AA`, 11px, `.12em`, uppercase) + `<h1>` "Pipeline"
    (25px/800, `letter-spacing:-.025em`) + **filter chips** (see below).
  - Right: **view toggle** segmented control + **"+ Capture lead"** button.
- **Summary strip** (below header, `margin-bottom:18px`): white card, `1px #E7E8EC`,
  radius 11px, padding `11px 18px`, flex row of items separated by 1px `#EDEDF1` dividers.
- **Kanban**: `display:grid; grid-template-columns:repeat(7,1fr); gap:12px; align-items:start`.
- **Won/Lost zones**: `display:grid; grid-template-columns:1fr 260px; gap:12px; margin-top:14px`.

### Filter chips (the old pages, as lenses — frame 29)
Pill row beside the title. Active chip: `background:#16181D; color:#FFF; font:700 11.5px;
padding:5px 11px; radius:999px`. Inactive: `border:1px #E2E3E8; color:#5A6069; font:600`.
Chips: **All** · **Mine** · **To qualify 3** (count in cobalt — replaces the Leads page) ·
**Proposals out 4** (count `#0891B2` — replaces the Proposals page) · **⚠ Stuck 5**
(amber treatment: `border:1px #FADCB4; background:#FFF7ED; color:#B45309`). A chip filters
the board in place — it never navigates.

### View toggle (segmented control)
- Container: `background:#F1F2F4; border-radius:9px; padding:3px; display:flex`.
- Active tab: `background:#FFF; color:#16181D; font:600 12.5px; border-radius:7px;
  box-shadow:0 1px 2px rgba(0,0,0,.06); padding:6px 12px`, leading glyph.
- Inactive tab: `color:#767B85; font-weight:500; padding:6px 12px`.
- Labels: **▦ Board** and **☰ List**.

### "+ Capture lead" button
- `border:0; height:36px; padding:0 15px; border-radius:9px; background:#16181D (ink);
  color:#FFF; font:600 13px 'Hanken Grotesk'`; leading "+" at 15px. (Ink, not cobalt —
  cobalt is reserved for brand/links/focus.)

### Summary strip contents (left→right)
- `Open $428k · wtd $164k` — label muted `#767B85`; figures mono tabular-nums, `$428k`
  bold `#16181D`, `wtd $164k` muted `#9AA0AA`.
- `23 open deals`.
- **Stuck pill**: `⚠ 5 stuck 14d+` — `background:#FFF7ED; border:1px #FADCB4; color:#B45309;
  font:700 12px; padding:3px 10px; border-radius:999px`.
- Pushed right (`margin-left:auto`): `This Q 7 won / 3 lost · 70%` — 7 won `#15803D`,
  3 lost `#B91C1C`, 70% muted, all mono tabular-nums bold.

### Columns (7)
Order = the funnel: **Triage · Discovery · Business req. · Solution design · Proposal ·
Negotiation · Contract**.

**Standard column** container: `background:#FFF; border:1px #E7E8EC; border-radius:12px;
padding:10px; display:flex; flex-direction:column; gap:8px`.

**Column header row** (`padding:4px 4px 0`, flex, gap:8):
- color square: `width:9px; height:9px; border-radius:2px` — stage color (see tokens).
- name: 13px/700.
- count pill: `font:600 10.5px; color:#767B85; background:#F1F2F4; padding:1px 7px;
  border-radius:999px`.
- meta line beneath (mono 9.5px `#9AA0AA`): `$72k · ≈10% close` ($ sum bold `#3A3F47`).

**Deal card**: `background:#FFF; border:1px #EDEDF1; border-radius:10px; padding:11px 12px;
box-shadow:0 1px 2px rgba(0,0,0,.04); cursor:grab`.
- title: 12.5px/700, cobalt `#2B3EE6` (links to the deal room), `line-height:1.3`.
- sub: mono 10px `#9AA0AA` — `Org · Owner`.
- footer (flex space-between, `margin-top:9px`): `$30k` mono tnum 12px/600 **and** a days tag.
  - normal days tag: mono 10px `#767B85`, `background:#F4F5F7; padding:1px 7px; radius:6px` (`3d`).
  - **≥14d stuck tag**: `⚠ 18d` — `color:#B45309; background:#FFF7ED; border:1px #FADCB4;
    font:700 10px; padding:1px 7px; radius:6px`.
- **Overflow line** (when a column has more cards than shown): centered mono 10px `#B4B9C1`
  — `+3 more · $24k`.

**Triage column (special — column 1):** visually marks "not deals yet".
- Container: `background:#F4F5F7; border:1.5px DASHED #D7D9DF; border-radius:12px; padding:10px`.
- Header: cobalt square `#2B3EE6` + "Triage" + count pill in cobalt wash
  (`background:#EEF0FE; color:#2B3EE6`).
- Caption under header: mono 9.5px `#9AA0AA` — "new leads land here".
- **Lead card**: white, `1px #E7E8EC`, radius 10px, padding `11px 12px`, `cursor:grab`.
  - top row: name 12.5px/700 + a `×` pass affordance (`#C4C8CF`, 13px, right-aligned).
  - sub: mono 10px `#9AA0AA` (source).
  - **score chip** (bottom): pill, `font:700 10px`, leading 5px dot —
    - pursue: `background:#DCF5E3; color:#15803D; dot #16A34A` → `8/10 PURSUE`
    - probe: `background:#FCEFDC; color:#B45309; dot #D97706` → `5/10 PROBE`
    - not scored: `background:#F1F2F4; color:#6B7280` → `not scored`
    - the number is mono.
- Footer caption: centered mono 9.5px `#B4B9C1` — "drag right to qualify →".

**Solution-design column is the "stuck" one:** tint the whole column
`background:#FFFAF2; border:1px #FADCB4`; count pill becomes `background:#FCEFDC;
color:#B45309; font-weight:700` reading `6 · 3⚠`.

### Won / Lost drop zones
- **Won**: `background:#DCF5E3; border:1.5px DASHED #9FD9B4; border-radius:12px;
  padding:13px 16px; flex; gap:12`. Green dot `#16A34A`; "Won" 13.5px/700 `#15803D`;
  pill `7 this quarter` (`background:#C6ECD2; color:#15803D`); `$212k` mono tnum `#15803D`;
  right-aligned hint mono 10px `#6BB383` — "drop a deal here → becomes a project".
- **Lost** (260px): `background:#FBE3E3; border:1.5px DASHED #ECB6B6`. Red dot `#B91C1C`;
  "Lost" 13.5px/700 `#B91C1C`; count pill `3` (`background:#F4CFCF`); hint "reason logged".

### Stage colors (column square)
| Stage | Square hex |
|---|---|
| Triage | `#2B3EE6` (cobalt) |
| Discovery | `#2563EB` |
| Business req. | `#0D9488` |
| Solution design | `#7C3AED` |
| Proposal | `#0891B2` |
| Negotiation | `#D97706` |
| Contract | `#4B5159` |

---

## Screen: Board (List view) — same route, ☰ toggle
Identical AppShell + header (List tab active). Then:
- **Leads nudge bar** (replaces the removed full strip): `background:#EEF0FE (cobalt wash);
  border:1px #DDE1FB; border-radius:11px; padding:11px 16px; flex; gap:11`. 7px cobalt dot;
  text "**3 new leads** waiting to qualify — 1 scored **pursue**"; right-aligned cobalt link
  "Review leads →".
- **4 stat cards** (`grid repeat(4,1fr) gap:12`): Open pipeline `$428,000` (+ weighted $164k),
  Open deals `23`, **Stuck 14d+** `5` (amber card: `border:1px #FADCB4;
  box-shadow:inset 3px 0 0 #EA8A0D`, all text `#B45309`), Won/Lost·Q `7 / 3` (70% win rate).
  Card = white, `1px #E7E8EC`, radius 12, padding `16px 18px`; label mono 10px caps `#9AA0AA`;
  number mono tnum 26px/800.
- **Stage sections** stacked (`flex column gap:10`): each a white card, header row
  (color square + name 14/700 + count pill + `$` sum + right-aligned `≈N% close`), then deal
  rows in a `grid-template-columns:1.4fr 1.6fr auto auto auto; gap:14`: name (cobalt link) ·
  org/contact/owner (mono) · `$` (tnum, right) · days tag / stuck tag · **stage dropdown**.
  - Stuck section: header `background:#FFFAF2`, card `border:1px #FADCB4`, count pill
    `6 · 3 ⚠ stuck` in amber.
  - Stage dropdown (one style): `font:600 11.5px; color:#3A3F47; border:1px #E2E3E8;
    border-radius:7px; padding:4px 9px`; trailing `▾` in `#B4B9C1`.
- Ends with green **Won strip** (solid, not a drop zone here): `background:#DCF5E3;
  border:1px #BFE6CC`, "Won" + `7 this quarter` pill + `$212k` + "View won deals →".

---

## Adjacent screens — copy/nav only

### Leads (absorbed into the board — no separate page)
- The Triage column IS the lead list (`status = to_qualify`); the **"To qualify" chip**
  filters to it. **Quick Capture** stays as the "+ Capture lead" button/modal.
- The **lead workspace** (frame 23's content: dossier, notes, ◆ Analyze scout report)
  renders inside the **lead drawer** — same shell as the deal drawer.
- Behavior to preserve: **Qualify** converts a lead into a deal in **Discovery** (≡ dragging
  the Triage card right). **Pass** = the `×` on a Triage card. One underlying store.

### Deal room (absorbed into the deal drawer)
- Route `/dashboard/sales/deals/[id]` → renders the **deal drawer over the board**.
- Drawer tabs: **Overview · Proposal · Contract · History** — the deal room's existing
  content (stepper, proposal A/B, contract checklist, history timeline) redistributed.
- Header: `← Board` (cobalt) top-left · mono route echo + `×` top-right · deal name +
  `$` (mono tnum) · mono meta line · **mini stage progress bar** (6 equal 5px segments,
  filled = `#2563EB`, rest `#EDEDF1`).
- Body leads with the **Next step card** (active-highlight style `1.5px #C9D0FB` bg
  `#FAFBFF`): title + "set by · due" + ink **Done → next** button. Then **Scout report ·
  from lead** (mono well) · **Latest** activity snippets.
- Footer bar (border-top): **Draft proposal** (ink) · **Log a call** (secondary) · right
  mono hint "Esc closes · board unchanged behind".

---

## Navigation contract (frame 29 — applies everywhere in Sales)
One surface, three depths. This is the core of the redesign for non-technical users:
1. **Click a card = peek** (popover beside the card).
2. **"Open →" = drawer** — lead workspace, deal room, and proposal editor are all the SAME
   right-side drawer shell (520px, `border-left:1px #E7E8EC`,
   shadow `-24px 0 60px -24px rgba(0,0,0,.28)`) over the dimmed board. One gesture to learn.
3. **Esc / ← Board / browser-back** all close the drawer and return to the EXACT board
   state (scroll + active filters). Implement drawers as routes (parallel/intercepting
   routes work well) so they're deep-linkable: `/sales/deal/meridian` opens the drawer over
   the board — links from Messages/email never land on a dead-end page.
4. The ONLY separate sales page left is the client-facing **public proposal** (frame 26).

## Interactions & behavior
- **Click any card = peek panel** (see frame `21c — Board · card peek`). The WHOLE card is
  the click target; click vs drag is disambiguated by a ~5px movement threshold. The peek
  anchors beside the card (popover, modal shadow `0 24px 60px -24px rgba(0,0,0,.35)`,
  radius 14px); Esc or × closes; the source card gets the active-row highlight
  (`1.5px #C9D0FB` + `0 0 0 3px #F3F5FF`).
  - **Lead (Triage) peek**: name + score chip + mono meta · **Scout report** in a mono
    well (`#FBFBFC`, `1px #EDEDF1`) · actions: **Qualify → Discovery** (ink), **Pass**
    (secondary), right-aligned cobalt link **Open →** (expands the peek into the drawer).
  - **Deal peek**: same shell — value, stage, days-in-stage, next step + **Open →**
    (the deal drawer). The scout report travels with the deal after qualify, so it's
    readable from the peek and drawer — no switching pages.
- **Drag a Triage card → Discovery**: this IS "qualify". Creates a deal from the lead;
  the card leaves Triage. Log the event.
- **Drag any deal card between columns**: stages are **dispositions** — any→any allowed,
  never enforced/gated, **every move is logged** (server action). The kanban's left→right
  layout carries the funnel meaning, so no explanatory caption is needed (the old list view
  had one).
- **Drag a deal → Won**: deal is won and **becomes a project**. **→ Lost**: prompt for a
  reason, then log it.
- **`×` on a Triage card**: pass/dismiss the lead.
- **Card title click**: opens the peek (NOT a page navigation).
- **View toggle** persists the user's Board/List preference.
- Column **overflow**: show a capped number of cards, then a "+N more · $Xk" line that
  expands the column.
- **Motion**: subtle only (≤150ms ease) — small lifts on drag, fades. No flourish.
- **Days-in-stage** auto-computes; the tag flips to the amber ⚠ stuck style at the
  **admin-configured stuck window** (default 14 days — see SLA settings below).
  A column containing any stuck deal switches to its amber treatment.

---

## Screen: Admin settings · SLAs & nudges — `/dashboard/settings`, admin only
New Settings section (frame `28`). Settings gains a sub-nav (same indented left-ruled
pattern as Sales): **AI agents · SLAs & nudges**. All thresholds **nudge, never block**.
Same card language as the AI-agents page (white cards, `1px #E7E8EC`, radius 12,
padding `16px 18px`; mono uppercase field labels 9.5px `#9AA0AA`; number inputs mono,
right-aligned, with a "days" unit suffix).

Configurable parameters (these replace the previously hardcoded values):
1. **Deal stuck window** — default `14` days + **per-stage overrides** (6 mini-cards,
   color square + stage name; unset shows muted "default", overridden shows the value in
   an active-highlight card `1.5px #C9D0FB` bg `#FAFBFF`). Drives the ⚠ stuck tags,
   amber column tint, and the "Stuck" summary count.
2. **Response SLAs** (row cards with a days input each):
   - *Lead triage* — default `3` days: new lead must be scored & qualified/passed or its
     Triage card flags ⚠.
   - *Proposal follow-up* — default `7` days: sent proposal with no client action prompts
     the owner.
   - *Client "waiting on you"* — default `2` days: delivery-side wait before the amber
     nudge escalates to email.
3. **Probability anchors** — per-stage % (10 / 25 / 40 / 60 / 75 / 90). Drives the
   weighted-pipeline figure and each column's "≈N% close" line.
4. **Nudge routing** — toggles/select: notify deal owner in-app (on), admin digest
   (select: Monday morning), escalate to email if unactioned 3 days (off by default).
5. Footer: **Reset to defaults** (secondary) + **Save changes** (ink).

State: one org-level `sla_settings` record (JSON) read by the Board, Leads, and
delivery nudges; changes apply immediately, no redeploy. The AI-agents page's old
"coming to this page" stub now cross-links here.

## State & data
- `deals` grouped by `stage` (Discovery … Contract); `leads` with `status` ∈
  `to_qualify | qualified | passed` and a `score` (1–10) + `verdict` (pursue/probe/pass).
  **Triage column = leads where status = to_qualify.**
- Aggregates for the summary strip / stat cards: open pipeline $ (+ weighted by stage
  probability), open deal count, stuck count (days_in_stage ≥ 14), won/lost this quarter,
  win rate.
- Stage move = `POST` a disposition change (append to history/log). Qualify = create deal
  from lead. Won = create project from deal.
- Suggested API shape mirrors the existing stage actions convention
  (`POST /api/.../:action`).

## Design tokens (used here)
- **Ink** `#16181D` · **Ink soft** `#3A3F47` · **Muted** `#767B85` · **Muted line** `#9AA0AA`
  · **Faint** `#B4B9C1` / `#C4C8CF`.
- **Borders** `#E7E8EC` / `#EDEDF1` / `#F2F3F5` · **Surface** `#F4F5F7` ·
  **Surface soft** `#FBFBFC`.
- **Cobalt** `#2B3EE6` (links/brand/focus) · **Cobalt text** `#2536C4` · **Cobalt wash**
  `#EEF0FE` (border `#DDE1FB`).
- **Amber / stuck**: bg `#FFF7ED` (col tint `#FFFAF2`), border `#FADCB4`, text `#B45309`,
  dot `#EA8A0D`, chip bg `#FCEFDC`.
- **Green / won**: bg `#DCF5E3`, border `#BFE6CC` (dashed `#9FD9B4`), text `#15803D`,
  dot `#16A34A`, pill `#C6ECD2`.
- **Red / lost**: bg `#FBE3E3`, border `#ECB6B6`, text `#B91C1C`, pill `#F4CFCF`.
- **Radius**: cards/columns 12px; cards inside 10px; small buttons/inputs 8–9px;
  pills 999px; outer frame 6px.
- **Shadow (card)**: `0 1px 3px rgba(0,0,0,.08), 0 12px 40px -24px rgba(0,0,0,.18)`;
  deal card lift `0 1px 2px rgba(0,0,0,.04)`.
- **Focus**: `2px solid #2B3EE6` + `0 0 0 4px #EEF0FE` ring.
- **Type**: sans **Hanken Grotesk** (400–800); mono **IBM Plex Mono** (kickers/IDs/meta,
  uppercase `.12em`); money = Hanken with `font-variant-numeric: tabular-nums`.

## Assets
No images. All glyphs are Unicode text (`▦ ☰ + × ⚠ ▾ →`). Logo is a CSS diamond
(ink rounded square + rotated cobalt square). No icon library required.

## Files
- `Wahala Portal.dc.html` — the full canvas. Look for frames labeled
  `21 — Board · kanban (canonical)`, `21 · List toggle`, `21c — Board · card peek`,
  `29 — Sales flow · one surface (canonical)`, `28 — Admin settings · SLAs & nudges`,
  plus `22/23/24/25` for the content that now lives inside the drawer.
  Ignore the dimmed `21 — retired` frame.
- `sales/sales-home.md` — narrative spec for the Board (this redesign).
- `sales/00-overview.md` — cross-cutting sales decisions (chip system, dropdowns, IA).
- `design-system.md` — full token & component reference.
