# Handoff: CRM Restructure — Contacts/Accounts, 5-stage pipeline, sales⇄delivery loop

> **Supersedes** parts of [`BOARD-REDESIGN.md`](BOARD-REDESIGN.md): the 7-column stage set
> (frame 21a) is retired. The kanban mechanics, drawer/peek navigation contract, SLA
> settings, and List-view treatment from that doc **still apply** — only the column set,
> the object vocabulary, and the deal→project handoff change, as specified here.

## Overview
This handoff restructures the CRM layer of the Wahala Portal around three decisions:

1. **Object model: two objects, not five.** `lead`, `client`, and `company` are no longer
   objects. A person is a **Contact** (forever — never converted, never frozen). An org is
   an **Account** (replaces both "client" and "company"). "Lead" and "client" become
   **states** on those records.
2. **Pipeline: 5 stages, not 7.** *Business requirements* folds into **Discovery**
   (on a 2-person team, requirements-gathering IS discovery). *Solution design* is
   deleted as a stage (it's the work of writing the proposal, not a client-facing state —
   it was the column where deals rotted). New set: **Triage · Discovery · Proposal out ·
   Negotiating · Committed**, then Won/Lost drop zones.
3. **Sales and delivery are one loop over the Account.** Paid discovery runs as a small
   project whose deliverable (roadmap/proposal) spawns the big deal; a Committed deal with
   a cleared deposit becomes a project with phases prefilled from the proposal; project
   closeout proposes the next deal. The **MSA lives at the Account level** — once signed,
   later deals skip legal and go proposal → SOW.

## About the design files
`Wahala Portal.dc.html` (this folder) is a **design reference created in HTML** — a
pannable canvas of labeled frames, not production code. Recreate these designs in the
existing codebase (Next.js App Router / RSC on Cloudflare Workers, D1, magic-link auth —
see [`patterns.md`](patterns.md)) using its established components.

**Frames for this restructure** (bottom band of the canvas):
- `30 — Object model · one system` — reference diagram of the objects, states, and loop.
  Not a screen; build nothing from it directly, but treat it as the data-model contract.
- `31 — Board · 5-stage kanban (canonical)` — replaces frame 21a.
- `32 — Capture contact · triage bypass` — replaces the "Capture lead" modal.
- `33 — Account · one thread (canonical)` — new Account page (replaces the Clients list
  as the org-level destination).
- `34 — Deal drawer · Committed` — the deal drawer's state at stage 5 (agreement
  checklist + deal→project handoff).
- `21 — Board · 7-stage` is now labeled **superseded**; do not build it.

## Fidelity
**High-fidelity.** Tokens in [`design-system.md`](design-system.md) are unchanged and
still authoritative (Hanken Grotesk / IBM Plex Mono, ink `#16181D`, cobalt `#2B3EE6`,
amber/green/red semantic sets, radii, shadows, focus ring).

---

## 1 · Data model (frame 30 — the contract)

### Objects
```
contacts   id, account_id, name, email (nullable), phone, role_note,
           state ∈ to_qualify | qualified | passed,
           source, score (1–10, nullable), verdict (pursue|probe|pass, nullable),
           is_primary, created_at

accounts   id, name, state ∈ prospect | client | past_client,
           industry_note, owner_user_id, msa_signed_at (nullable),
           created_at
           -- "client" is DERIVED-ish: an account becomes client on first won deal;
           -- store it as a column but transition it automatically.

deals      id, account_id, primary_contact_id, name, value_cents,
           stage ∈ triage_bypass_n/a — see note | discovery | proposal_out |
                   negotiating | committed,
           origin ∈ captured | qualified_from_triage | bypass |
                    spawned_from_project (project_id),
           est_close, days_in_stage (derived), created_at

projects   (existing object — unchanged lifecycle) + account_id,
           spawned_from_deal_id (nullable), kind ∈ standard | paid_discovery

agreements id, account_id, deal_id (nullable — MSA/NDA are account-level),
           kind ∈ msa | nda | commercial_agreement | ip_schedule |
                  professional_services | dpa | security_addendum |
                  support_agreement | licensing,
           status ∈ needed | sent | signed | n_a, signed_at
```

### Semantics
- **Triage is not a deal stage.** The Triage column renders `contacts WHERE state =
  to_qualify`. A deal is created only when a contact is qualified (drag right, or bypass
  at capture). Deals therefore have 4 stages; the board has 5 columns.
- **No conversion, ever.** Qualifying a contact sets `state = qualified` and creates a
  deal referencing it. All surfaces (board card, peek, drawer, account page) read/write
  the same contact row — an email edit anywhere updates everywhere. Never require moving
  a card backwards to edit data.
- **Account state transitions:** `prospect` on creation → `client` automatically on first
  won deal → `past_client` manually (or by inactivity rule later). The green "Client"
  badge and the sidebar vocabulary derive from this.
- **Renames across ALL existing UI:** sidebar "Clients" → **Accounts**; every
  "lead" string → **contact** (or "to qualify" where it names the state); "company" →
  **account**. Routes: `/dashboard/clients` → `/dashboard/accounts`,
  `/dashboard/accounts/[id]` is the new Account page (frame 33). Keep old routes as
  redirects.
- **Stage probability anchors** (drive weighted pipeline + column meta lines):
  Discovery ≈25% · Proposal out ≈55% · Negotiating ≈75% · Committed ≈90%. Editable in
  Admin settings (frame 28's per-stage cards drop from 6 to 4).

### The loop (must hold end-to-end)
```
contact captured ──► deal (Discovery) ──► [optional] paid-discovery project (small, kind=paid_discovery)
                                              │ deliverable = roadmap/proposal, formally accepted
                                              ▼
                     deal (Proposal out ► Negotiating ► Committed)
                                              │ agreements checklist complete + deposit paid
                                              ▼
                          project (phases prefilled from proposal line items)
                                              │ closeout
                                              ▼
                          prompt: "propose the next deal" ──► new deal on the same account
                          (origin = spawned_from_project; MSA on file ⇒ fast lane)
```

---

## 2 · Screen: Board — 5-stage kanban (frame 31) — `/dashboard/sales`, staff

Everything from `BOARD-REDESIGN.md` (AppShell, header, filter chips, view toggle, summary
strip construction, card anatomy, peek/drawer navigation, drag semantics, stuck logic,
Won/Lost zones, List view) **carries over**. Deltas:

### Columns (5, left→right)
| Column | Square hex | Meta line | Notes |
|---|---|---|---|
| Triage | `#2B3EE6` | "unknowns only — known-enough contacts bypass this column" | dashed container as before; renders contacts |
| Discovery | `#2563EB` | `$118k · ≈25% close · incl. requirements` | absorbs Business req. |
| Proposal out | `#0891B2` | `$152k · ≈55% close · the at-risk clock` | days tag reads `sent Nd`; ⚠ amber `Nd silent` at the proposal-follow-up SLA (default 7d) |
| Negotiating | `#D97706` | `$98k · ≈75% close · client engaged` | cards may carry a status chip: `redlines with counsel` (amber chip `#FCEFDC`/`#B45309`) or `verbal yes · terms open` (green chip `#DCF5E3`/`#15803D`) |
| Committed | `#4B5159` | `$285k · ≈90% · docs + deposit` | cards carry `docs N/5 · deposit due` chip (grey `#F1F2F4`/`#3A3F47`) or `MSA on file · SOW only` (green); column footer caption: "deposit clears → project ↓" |

### Header / strip deltas
- Button label: **"+ Capture contact"** (was "Capture lead") → opens frame 32's modal.
- Summary strip gains an **at-risk time** item: `at-risk time $152k · proposals with no
  reply` = Σ value of Proposal-out deals past the follow-up SLA. Sits between "open
  deals" and the stuck pill.
- Sidebar: one-surface model (no sub-nav) as per frame 29; "Clients" entry renamed
  **Accounts**.
- Won zone hint copy: "drop a deal here → becomes a project **on the same account**".

### Behavior deltas
- Dragging a card into **Committed** does NOT create the project. The project is created
  by the explicit **Create project →** action in the deal drawer once the deposit
  clears (frame 34), or by dragging to **Won** (same action, same guard: if the
  agreements checklist is incomplete, confirm with a warning, never block).
- A deal card whose `origin = spawned_from_project` or `kind = paid_discovery` shows the
  cobalt-wash chip `◆ paid discovery · runs as a project` (bg `#EEF0FE`, text `#2536C4`,
  card border `#DDE1FB`).

---

## 3 · Screen: Capture contact modal (frame 32) — from "+ Capture contact"

Modal, 560–600px wide, radius 16px, modal shadow. Title **"New contact"**, mono caption
"one record forever — lead is a state, not a thing".

**Fields**
- Name (required) · Email (optional — label literally says "optional now, editable forever")
- **Account** combobox: type-ahead against existing accounts (row shows 22px initials
  square + name + mono `existing account · <state>`), trailing cobalt "+ create new"
  (creates an account inline with just a name). Focus state = cobalt ring.
- Source (select) · Est. value (mono input; label "gut call is fine")
- "What they need" textarea (this is the intake note; it travels to the deal as the
  scout/intake note)

**Qualification quick-check** (the bypass mechanism)
- Well: `#FBFBFC` bg, `1px #EDEDF1`, radius 11. Label "ALREADY KNOW ENOUGH?" + live mono
  counter (`2 of 3 — fast lane open`, green `#15803D` when ≥2).
- Three toggle chips: **Real need · Budget signal · Decision maker**. Checked = green
  chip (`#DCF5E3` bg, `#BFE6CC` border, `#15803D` text, leading ✓); unchecked = white,
  `1px #E2E3E8`, `#767B85`.
- Caption: "check what you know — 2+ unlocks 'Start deal'. unchecked contacts go to
  Triage for scoring."

**Footer** — two buttons:
- **Save to Triage** (secondary) — always enabled. contact `state=to_qualify`, appears in
  the Triage column.
- **Start deal → Discovery** (ink, flex-grow larger) — enabled when ≥2 chips checked.
  Creates contact with `state=qualified` AND a deal in Discovery
  (`origin=bypass`), attached to the chosen account. Log the bypass in history.
- Mono caption under: "start deal = contact marked qualified · card opens in Discovery ·
  bypass logged".

---

## 4 · Screen: Deal drawer · Committed state (frame 34)

Same 520px drawer shell + navigation contract as frame 29 (`← Board`, mono route echo,
`×`, Esc closes, deep-linkable route `/sales/deal/[slug]`). This frame specifies the
**Committed-stage body**:

- Header: deal name + `$225,000` (mono tnum) · mono meta (`account · contact · owner ·
  n phases · n wks`) · provenance chip when applicable: `◆ born from paid discovery —
  Assessment sprint · accepted 12 Jun` (cobalt wash) · **stage progress bar now has 5
  segments** (filled `#2563EB`), mono caption `stage 5 of 5 — Committed`.
- **Agreement package** section: mono kicker + right-aligned mono progress `4 / 5`
  (green when complete). One row per agreement (from the `agreements` table, filtered to
  this deal + account-level docs):
  - Done row: `#FBFBFC` bg, `1px #EEF0F2`, radius 10; 20px green ✓ circle; bold 13px
    title; mono 9.5px sub (e.g. "Option A — custom build · signed 28 Jun").
  - Blocking row (deposit): amber treatment (`#FFF7ED` bg, `1px #FADCB4`); ⚠ circle;
    title `#B45309`; sub shows waiting state + nudge timing; trailing cobalt action
    (`Resend →`).
  - Which docs appear is driven by the deal's option/flags (Option B adds Licensing
    terms; PII in scope adds DPA) — mirror the package structure in the agreements table,
    don't hardcode five rows.
- **"When the deposit clears" card**: active-highlight style (`1.5px #C9D0FB`,
  bg `#FAFBFF`). Copy: "This deal becomes a project on the {account} account." + mono
  list of phases prefilled from proposal line items (name · $ · duration) + mono note
  "SOW drafts after signature — the proposal scope carries over, nothing re-typed." +
  ink button **Create project →**. Button disabled until the deposit row is cleared
  (tooltip explains), EXCEPT admins may force with the standard ConfirmDialog.
- Footer: secondary **Log a call** · **View proposal** · right mono hint "Esc closes ·
  board unchanged behind".

**Create project action:** creates `projects` row on the same account
(`spawned_from_deal_id` set), one stage per proposal phase (names, amounts, durations
from proposal line items), status per the existing stage lifecycle (draft). Deal leaves
the board (won). Navigate to the new project.

---

## 5 · Screen: Account page (frame 33) — `/dashboard/accounts/[id]`, staff

Full AppShell (sidebar: **Accounts** active, cobalt pill; Sales carries the to-qualify
badge). Main on `#FBFBFC`, padding `26px 30px 30px`.

- Breadcrumb mono: `Accounts / Talden`.
- **Header row**: 46px radius-12 initials square (`#F1F2F4`/`#3A3F47`) · H1 24/800 ·
  StatusBadge for account state (Client = green set; Prospect = blue `quoted` set;
  Past client = grey `draft` set) · **MSA chip** `MSA signed · new work skips to SOW`
  (cobalt wash pill, `1px #DDE1FB`) — omit if unsigned; if unsigned and ≥1 won deal,
  show amber `⚠ no MSA — repeat work renegotiates legal` as a prompt · mono meta line
  (industry · since · #contacts · owner · lifetime $) · right: ink **+ New deal** button.
- **Two-column grid `1.5fr 1fr`, gap 16:**
  - **Left — "One thread — sales & delivery"** (white card): a single HistoryTimeline
    interleaving events from deals, projects, agreements, and contacts on this account,
    newest first. Node colors follow the event's domain (deal stage color, project green,
    account cobalt). Loop moments get the cobalt chip `↺ spawned the next deal`. Event
    rows: 13px text with bold lead-in, mono 10px `domain · date` sub.
  - **Right rail** (stack, gap 14 — all white cards, `1px #E7E8EC`, radius 12,
    padding 16/18):
    1. **Contacts** — rows: 32px avatar (primary contact = ink avatar, others surface),
       name 12.5/700 + mono role, mono email, trailing cobalt **Edit**. A missing
       required field renders the amber dashed chip `⚠ add email` (as specified in
       BOARD-REDESIGN's contact block — the chip IS the input trigger). Footer mono
       caption: "edits apply everywhere — board, deals & projects". `+ add` in header.
    2. **Open deals** — rows: stage color square · deal name (cobalt link 12.5/700) ·
       mono `stage · $value · substatus` · trailing mono cobalt `board →` (deep-links to
       the board with the deal's drawer open).
    3. **Projects** — rows: status dot (green = active/closed-accepted, grey = pending) ·
       name · mono sub. Paid-discovery closeouts show mono `↺ spawned deal`; a project
       pending deposit shows `created on deposit · n phases prefilled` + grey `pending`
       pill.
    4. **Agreements** — account-level list: 16px ✓/– circles, name, mono date or note
       (`needed — PII in scope`). This is the same data the deal drawer's checklist reads.

---

## 6 · Interactions & state summary

- **Qualify** = drag Triage card → Discovery OR bypass at capture. Both: contact
  `state=qualified`, deal created, event logged.
- **Pass** = `×` on Triage card → contact `state=passed` (kept, searchable — never
  deleted).
- **Won** = drawer "Create project →" (preferred) or drag to Won zone. Creates project on
  the account, flips account `prospect → client` on first win.
- **Lost** = drag to Lost zone → reason prompt → logged.
- Stage moves are dispositions: any→any, never gated, always logged (unchanged).
- **SLAs** (frame 28) — per-stage override cards now list the 4 deal stages; the
  proposal-follow-up SLA drives the `Nd silent` amber tag and the at-risk-time strip
  figure.
- **Days-in-stage / stuck** logic unchanged (default 14d, admin-configurable).

## 7 · API sketch (mirrors existing conventions)
```
POST /api/contacts                       create (body: …, qualifyNow: bool)
POST /api/contacts/:id/:action           action ∈ qualify | pass | update
POST /api/deals/:id/:action              action ∈ move_stage | mark_lost | log_call
POST /api/deals/:id/create_project       guarded by deposit unless admin-forced
POST /api/accounts/:id/agreements/:kind/:action   action ∈ mark_sent | mark_signed | mark_na
GET  /api/accounts/:id                   account + contacts + deals + projects + agreements + timeline
```

## 8 · Migration notes
- Rename tables/columns or add views: `leads` → fold into `contacts` (state carries the
  old status); `clients`/org records → `accounts`. Backfill: existing clients →
  `accounts(state=client)`; open leads → `contacts(state=to_qualify)` + account by org
  name where matchable.
- Map old deal stages: `business_req → discovery`, `solution_design → proposal_out`
  (they were drafting proposals), `proposal → proposal_out`, `negotiation → negotiating`,
  `contract → committed`. Log a migration disposition per deal.
- Update copy site-wide per the rename table in frame 30. Grep targets: "lead", "Lead",
  "client", "Client", "company".

## Files
- `Wahala Portal.dc.html` — full canvas; this restructure = frames 30–34 (bottom band).
- `screenshots/30-object-model.png` … `screenshots/34-deal-drawer-committed.png` — reference captures of each frame.
- `support.js` — canvas runtime.
- [`design-system.md`](design-system.md) — tokens (unchanged, authoritative).
- [`patterns.md`](patterns.md) — architecture & constraints (unchanged).
- [`BOARD-REDESIGN.md`](BOARD-REDESIGN.md) — kanban mechanics, drawer contract, SLA
  settings — still valid except the 7-column set (superseded by this doc).
