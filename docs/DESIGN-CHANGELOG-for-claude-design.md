# Wahala Portal — UI changelog for Claude Design

Hand this to the Claude Design project so it can update the canvas. It lists **what
changed in the shipped UI** since the last handoff, in design terms (layout,
components, states). Frame numbers refer to the original design handoff
(`Wahala Portal.dc.html`). Live build status is also tracked in `DESIGN-STATUS.md`.

The big shift this round: the engagement model. A **stage = a fixed-price phase**;
its scope is a list of **deliverables grouped by epic** (not many priced line items);
internal **tasks** hang under a deliverable and each carries a **subtask checklist +
a notes worklog**; and the client can raise a **change order** ("I want a change").

---

## A. NEW screens to add to the canvas

### Frame 12 — Client account hub  ·  `/dashboard/clients/[orgId]`  (staff)
The durable home for one client org. Reached by clicking a client row in frame 14.
- **Header:** ink rounded logo tile (org initials) · org name (h1) · mono meta
  "Client since {date} · N projects · N stages" · account-owner PeopleCard (right).
- **Tab row:** Overview · Work history · People · (Files, Messages shown disabled "soon").
- **Overview:** optional intake-notes card; a **work-history timeline** (status-colored
  node dots, "Project · Stage", mono "Accepted · date · $amount"); a Projects list; and
  a right rail of two cards — **Lifetime totals** (Paid to date / Accepted work / Open
  pipeline) and **People** (Wahala team + client contacts).
- **People tab:** two columns — Client contacts (avatar, name, role tag, email, status
  pill) and Wahala team (PeopleCards).

### Frame 07 — Acceptance (mobile)  ·  `/dashboard/stages/[id]/accept`  (client)
Dedicated phone-width (390px) accept moment for a **delivered** stage.
- Teal **"Delivered — your acceptance needed"** badge · stage name · intro line.
- **Checklist grouped by epic**: green ✓ tiles, deliverable text (+ estimate note), amount.
- A **"Paid in full"** total card.
- Big green **Accept delivery** + outlined red **Request revision** · micro-note
  "Acceptance is final & recorded".
- **Confirm dialogs:** green check tile for accept ("records all N items… can't be
  undone"); red tile for revision **with a note textarea** ("What needs changing?").

### Frame 11 — Messages  ·  `/dashboard/messages`  (now a live sidebar item)
Threaded, attributed comms. **Two thread levels:** an **Account** thread per client org
(the durable client↔Wahala line, exists before any project) + one per **project**.
- **Left, 300px thread list:** each row = waiting-on dot + title; account threads carry a
  small cobalt **"Account"** tag; project threads show the org (staff); last-message snippet.
- **Right, thread view:** header (title + Account tag / org) with a **WaitingOn pill**
  phrased for the viewer ("Waiting on you" amber vs "Waiting on Wahala / the client" grey);
  **message bubbles** — Wahala left `#F4F5F7`, client right `#EEF0FE`, each with avatar +
  name + mono "{org} · {date time}"; a **composer** (textarea + Ink Send, a "Needs a reply
  from {them}" checkbox, ⌘/Ctrl-Enter).

---

## B. Existing frames to UPDATE

### Frame 06 — Quote / scope builder  (was: per-line pricing)  ·  `/dashboard/stages/[id]/quote`
- Now a **single fixed Stage price** lives in the right summary rail (big editable `$`
  field), replacing the summed "Quote total". A hint shows "{N} deliverables · items add
  up to $X".
- The list is now **Deliverables** (renamed from "Line items"). **Each row gains an
  "Epic" field** (left, narrow) so deliverables group under an epic; per-item **amounts
  are optional/illustrative**. Row = ⠿ drag · Epic · description (+ estimate note) · amount · ✕.
- "+ **Add deliverable**" (carries the last row's epic). Over-threshold **co-sign banner**
  (#FFFAF2 / #FADCB4) unchanged.

### Frame 05 — Stage detail  ·  `/dashboard/stages/[id]`  (several additions)
- **Deliverables** section (renamed from "Line items") now renders **grouped by epic**
  (cobalt epic subheaders), each item with the accept ✓ + amount.
- **Tasks** section: tasks are **grouped under their deliverable**; each task row is
  **expandable (▶)** to reveal a **subtask checklist** (checkboxes) and a **notes worklog**
  ("Notes — what was done", attributed + dated), with inline add for staff. Collapsed
  header shows "{done}/{n} subtasks · {n} notes". The add-task form gains a **deliverable
  selector**. Clients see these read-only and only on client-visible tasks.
- **NEW "Changes" section** (change orders): a **Request a change** button (client + staff)
  opens a name + detail form; each change shows a status pill —
  **Requested → Quoted → Approved → Paid → Applied** (or **Declined**) — the price (or
  "No charge"), and role-appropriate buttons (staff: Send quote with inline `$` entry, "0
  to absorb", Decline, Apply; client: Approve / Reject; admin: Mark paid).
- Action rail "Your next action" now also surfaces **Edit quote** (staff, draft) and a green
  **Review & accept** (client, delivered → links to frame 07).

### Frame 14 — Clients  ·  `/dashboard/clients`  (relayout)
- Now **two columns**: **left** = a **status filter row** (All / Invited / Accepted **with
  counts**, active = ink chip) above the **clients table** (each row leads with a **company
  avatar**); **right** = the **"Onboard a client" panel on a slight-grey background**
  (`--surface`), sticky, inputs white-filled, contact name/email stacked.
- The onboard form no longer shows a lingering green "Invited …" line — the new client
  **row** (with its Invited pill) is the confirmation.

### Frame 15 — Client welcome  ·  `/dashboard` (new client, no projects)
- Hero **CTAs removed**; ends with a bold line "Your Wahala representative is {agent}.
  {agent} will contact you shortly…".
- The "Your Wahala agent" card's **"Message {agent}"** now **opens the in-app Account
  thread** (frame 11) instead of launching an email client (was a `mailto:`).

---

## C. New components / patterns (for the component sheet, frame 01)
- **Epic group header** — kicker style, cobalt, above a deliverable/task group.
- **Deliverable** — renamed from "line item" (client-facing scope item; amount optional).
- **Subtask checklist** + **Notes worklog** — the expandable detail under a task.
- **Change-order card** + status pills (Requested/Quoted/Approved/Paid/Applied/Declined).
- **Account-thread badge** — small cobalt "Account" tag in the thread list/header.
- **Status filter chips** — All/Invited/Accepted with counts (active = ink).
- **Viewer-aware WaitingOn pill** — "Waiting on you" vs "Waiting on the client/Wahala".
- **Auto-refresh (behavioral)** — Clients, stage, dashboard, and Messages poll ~8s while
  something is pending (e.g. an invite outstanding) so cross-session changes appear live;
  no manual refresh. No dedicated visual, but worth noting in flows.

## D. Terminology to update across the canvas
- **"Line item" → "Deliverable."** Deliverables group under **Epics**. Internal **Tasks**
  hang under a deliverable and carry **Subtasks** + **Notes**. A **Change order** is the
  client's "request a change" object.

## E. Not yet built (don't design final billing UI around the old model)
- **Milestone billing** (deposit at signing + payment on each phase's acceptance) is the
  next phase and **not built** — today a stage is still "pay in full before work" (admin
  "Mark paid"). A future payment-schedule screen will come with it.

---

# Update — 2026-07-06 (demo-review response)

Responses to the three findings from the first demo-URL review
(https://wahala-portal-demo.jason-milton-43f.workers.dev):

## 1. "Phase" vocabulary — code fixed, "Stage" is canonical
The docs were right; the code had drifted. Delivery units are **Stages**
(draft→quoted→approved→paid→in_progress→delivered→accepted); sales deals move
through **pipeline steps** (never "stages" — that word is reserved for delivery).
Renamed across every shipped surface: project page ("Stages (N)", "+ New stage —
scope the next phase" per the original frame copy), stage detail ("Stage total"),
quote builder ("Stage name", "Stage price · fixed"), AI draft flow, client
welcome ("delivered stage by stage"), client dashboard cards ("Stage N of M"),
accept page, confirm dialogs, change orders, and API/domain error messages.
The word "phase" now appears only as informal prose where it isn't naming the
object, and in AI extraction prompts that must echo a client SOW's own
"Phase 1/2/3" naming verbatim (source fidelity, not chrome).

## 2. "AI memory" card on the Account page — intentional, please add to canvas
Not new drift — it shipped with the frame-33 Account page round as a documented
addition (previously called the "client memo"). Spec to document:
- **Object:** one markdown memo per Account (`organizations.ai_context_md`),
  labeled "AI memory" with caption "client-memory.md" (mono).
- **Purpose:** the durable account-level context every AI agent reads before
  drafting (proposals, SOWs, digests). Two write paths: staff edit it directly
  (collapsed card, edit-in-place, admin or the account owner only), and **winning
  a deal auto-graduates the deal's Discovery summary into it** — that's the
  reason it lives on the Account, not the deal.
- **Placement:** collapsed card on the Account page overview, below the timeline.

## 3. Demo data now covers the Stage-detail screen (frame 05) + quote flow
The demo Acme project ("Acme Website Revamp") now carries the full pay-as-you-go
spine: **Stage 1 accepted** (paid + delivered + client-accepted), **Stage 2
in_progress** (quote approved, paid, acceptance checklist with 2 of 4
deliverables completed, grouped under "Design system" / "Site build" focus
areas), **Stage 3 quoted** (awaiting client approval — renders the quote/approval
surfaces). Fetch `/dashboard/projects/prj_acme_0001` and follow the stage links.
Also seeded earlier for this loop: a sent A/B proposal at
`/dashboard/proposals/prop_harbor_0001`.

Standing note: the demo redeploys automatically with every production deploy, so
"pull latest from GitHub + fetch the demo URL" always compares like against like.

---

# Update — 2026-07-07 (vocabulary flip implemented)

The 06-Jul naming call (**Phase** = project delivery unit, **Stage** = deal
pipeline, exclusively) is now live in the build — this inverts the previous
"pipeline steps / project Stages" convention AND the 06-Jul-code rename that
briefly standardized delivery on "Stage":

- **Delivery is Phase everywhere:** project page ("Phases (N)", "+ New phase —
  scope the next one"), phase detail ("Phase total"), quote builder ("Phase
  name", "Phase price · fixed"), quote approval ("Phase total · fixed price"),
  AI draft flow, client welcome + dashboard cards ("Phase N of M"), contract
  room ("Phase 1 opens paid"), invite modal, confirm dialogs, change orders,
  and API/domain error messages.
- **Deal pipeline is Stage:** drawer says "stage 5 of 5 — Committed" and
  "{N}d in stage"; the disposition caption now reads "Stages are dispositions…
  Phases belong to projects; Stages belong to deals"; the training-mode
  stages-vs-gates explainer matches ("Stages report; gates enforce").
- **Routes renamed** per `design-system.md`: `/dashboard/phases/:id`
  (+ /accept /approve /quote) and `/api/phases/...`. Old `/dashboard/stages/...`
  URLs (in previously-sent emails/notifications) 307-redirect to the phase
  routes. NOT renamed (documented deviation): internal identifiers — the D1
  table is still `stages`, and code symbols like `StageError`/`stage-machine`
  keep their names; the design constraint reads on user-visible surfaces, and a
  live-DB table rename is all risk for no user-facing gain.
- **Settings · AI agents (frame 27 refresh):** already matched the updated spec
  (7 cards incl. "Contact scout (analysis)" and "Package extractor (readiness)",
  sub-nav, thresholds pointer, ▸ System prompt disclosure) — no change needed.
- **AI memory rail item 5:** already in place on the Account page rail below
  Agreements; summary label now reads "AI memory (client-memory.md)" to match.
- **Demo data relabeled:** the Acme fixtures are now "Phase 1/2/3 — …";
  `/dashboard/phases/stg_acme_0002` is the in-progress key screen.

---

# Update — 2026-07-07 (Proposals & Contract/SOW rebuild SHIPPED)

`HANDOFF-DELTA-2026-07-07-proposals-and-contracts.md` + the interactive
prototype are implemented end-to-end and live (prod + demo).

- **Phased sign-off system:** N options A–H (min 1, "+ Add option" / ✕), each
  lump-sum or phased (editable name/$/weeks rows); recommended is admin-chosen
  with toggle-OFF valid, nothing ever auto-recommended; complexity is 5
  clickable dots while Draft (default from the deal-size formula). Editor is
  the two-column spine layout: master signature dot (grey/cobalt/green ·
  "DocuSign · sealed"), per-phase rows with "Activate & amend →" + inline
  Cancel/Confirm (strict preconditions; every amendment audit-logged as
  `proposal.phase_amended` — one better than the prototype's toast), approvers
  at the bottom. Draft inputs vs locked text gated on opposite booleans per §3.
- **Sign flow:** public page rebuilt mobile-first — ink header, tap-to-select
  tiles (recommended preselected), type-name → Sign & approve, **Decline (new —
  the public page previously had no decline path at all)**, and the "Signed &
  sealed" dark takeover with the what-unlocked list. On sign the deal moves to
  **Committed** (per the updated §3.3) and Phase 1 flips active.
- **Contract/SOW:** one-time snapshot per §5 (exact boilerplate, WG-2026-NNN,
  deposit % dfaults, out-of-scope/change-mgmt track complexity>3), fixed section
  order, flat one-per-line textareas, Draft→Sent→Executed with the single lock
  wrapper, staleness banner + name-matched resync (draft only), executed-only
  amendment log. Payment schedule reproduces the Talden numbers exactly
  ($22,500 / $42,500 / $95,000 / $65,000 / $225,000) — unit-test pinned.
- **Hybrid drafting (decision):** the setup modal's math (option shapes, phase
  splits, prices, complexity) is the prototype's formulas verbatim (in cents);
  a real AI call writes ONLY the prose (exec summary grounded in
  `deal.discoveryNote`, option names, concrete phase names) with the
  deterministic template strings as automatic fallback. AI never prices — the
  schema has nowhere to put a number.
- **Nav:** ◆ Proposals sits between Sales and Accounts with the sent-count
  badge. **Path deviation:** pages live at `/dashboard/proposals[/:id[/contract]]`,
  not the prototype's `/dashboard/sales/proposals` — that segment renders the
  board+drawer behind children, contradicting "first-class nav item"; old URLs
  redirect.
- **Deal drawer:** Proposal tab = the two creation paths side by side ("◆ Rough
  out a draft" setup modal / "+ Blank proposal") or the "◆ View full proposal →
  {status}" shortcut; a declined proposal re-opens the creation paths.
- **Demo data:** `deal_harbor_0003` carries the approved Talden-shaped proposal
  (Phase 1 active) + generated contract at
  `/dashboard/proposals/prop_harbor_1001` (+`/contract`); the marina deal has a
  sent 2-path proposal (badge shows 1) with a live public page. Old A/B fixture
  replaced. Versioning/supersede semantics remain in storage; UI is
  one-live-proposal-per-deal with Delete (draft/sent only) instead of
  "Draft new version".

---

# Update — 2026-07-07 (deal drawer aligned to the prototype card)

Adam flagged that the shipped drawer didn't match the prototype's deal card;
now aligned:

- **Tabs are gone** (Overview / Proposal / Agreements / History). The proposal
  CTA sits directly under the value — "◆ Rough out a draft" + "+ Blank
  proposal" side by side when none exists, "◆ View full proposal … {status} →"
  when one does (opens the Proposals page). Agreements render inline at
  Committed as before (deposit → Create project untouched). **History left the
  drawer; the audit backend + HistoryTimeline component are intact — its new
  surface is TBD with Adam.**
- **4-step stepper** (Discovery → Proposal out → Negotiating → Committed) with
  "stage N of 4 — {label}" caption replaces the 5-segment bar + stage dropdown;
  **"Move to {next}"** + **"Mark lost"** (reason prompt) replace "Done → next".
  Move-to carries the same readiness-nudge intercept as board drag (training →
  modal; off → quiet override log). Backward/skip moves = board drag only
  (Adam's call). Caption: "stages are never gates — overrides are logged to
  the deal".
- **Compact TRAINING/readiness card** under the stepper (goal sentence +
  DISCOVERY PACKAGE + READY pill + explainer) replaces the goal rail.
- **Deliberately kept below the designed card** (Adam's call — he'll raise
  with design): next-call MeetingCard + reschedule, after-the-call card, past
  meetings, the FULL discovery-package panel (field rows, ask-next-call strip,
  recorded calls), discovery distill, scout report, contact, deal record;
  footer is now "Schedule call · Log a call" only.
- Omitted for now: the meta line's "· N phases · N wks" suffix (drawer doesn't
  load option phases; cheap to add if wanted).

---

# Update — 2026-07-07 (proposal editor design pass)

Per Adam's screenshot review of the editor:
- Header = mono `ORG · V{n}` + status pill + COMPLEXITY dots inline (interactive
  in draft, static locked); deal name h1 below; the ◆ Cn/5 pill is gone.
- Option names are static text (not editable for now — server capability kept).
- Recommended = the green treatment (green tint card, green letter tile,
  RECOMMENDED label top-right; clicking it toggles off). "Mark recommended" is
  the quiet grey link beside ✕.
- "+ Add phase" is a green text link; timeline placeholder matches the frame.
- Spine spans the full height of the content beside it; kicker is "PHASED
  AGREEMENT"; approvers render one-line ("Bob Ross — Owner").
- Action row: Save draft (flushes autosave) · Send to client → · **Preview
  public page ↗** (new staff-only /dashboard/proposals/[id]/preview — drafts
  have no share token, so this renders the exact public page with sign/decline
  inert) · ◆ Generate contract / SOW (now available in Draft; becomes View →)
  · Delete proposal (red, right).

---

# Update — 2026-07-08 (first-QA-pass delta SHIPPED)

All five findings from `HANDOFF-DELTA-2026-07-08-first-qa-pass.md` are live:

1. **Capture keeps everything.** The capture modal gained the Owner select
   (Est. value · Owner two-up, defaults to the current user); est. value, the
   intake note, and owner persist on the contact and carry onto the deal at
   qualify AND bypass (`value`, `discoveryNote` — which now grounds the
   proposal drafting — and `owner`). Triage cards show the mono estimate +
   `est · {owner}` sub-line; the contact drawer shows est · owner · source and
   the intake note verbatim.
2. **Qualify never asks for an account.** Capture now REQUIRES an account
   (Save-to-Triage disabled until one is picked or created inline; the API
   rejects accountless contacts). The qualify strip's account picker is gone —
   the deal opens on the contact's account (legacy accountless contacts get a
   one-field create fallback).
3. **Invite acceptance auto-links.** First login on an invite links the login
   to the existing contact by email; if none exists on the account, a contact
   is created ("one record forever" — verified zero duplicates through the
   real invite→accept flow). No invite at capture, as decided.
4. **Two axes, one row.** Account-page contact rows now show the sales chip
   (`to qualify`, only while staff-relevant) AND the portal pill
   (`invited · awaiting first login` grey / `portal · accepted` green) side by
   side on the same record.
5. **No dead client nav.** Files is a real client page (client-visible files
   across projects, or the empty state with the account owner + "Message
   {owner}"); the day-zero client home is the welcome hero with the named
   owner + message action; the projects list's empty state carries the same
   accountability pitch.

Also shipped from the prototype-changes note: **entering Committed via the
public signature now seeds the agreement/deposit checklist** (it previously
only seeded via a manual stage move) — verified: sign → Committed with the
full package + deposit gate, no Create-project dead end.

---

# Update — 2026-07-08 (founder decision: bare leads capture without an account)

Relaxes the strictest reading of the QA delta's §2. Adam's call: a person you
just met IS capturable with only a name — no account yet, they're a lead.
- **Capture**: the Account combobox is optional for "Save to Triage" (label
  now says so). Typed-but-not-created account text is kept as the free-text
  company note, never discarded. "Start deal → Discovery" (bypass) still
  requires an account.
- **Qualify**: unchanged from §2's core — it never *asks* when the contact has
  an account; a bare lead gets the one-field "Account name (creates it)"
  fallback at qualify, and everything captured (est value, intake note, owner)
  still carries onto the deal.
Please update the capture-modal spec (frame 32 / QA delta §1–2) to match.

---

# Update — 2026-07-08 (Committed → Won seam hardened, per the prototype update)

Implements the interactive prototype's `_deriveProposalPhases` /
`_ensureAgreementsForCommit` changes and the intent of "Production Walkthrough —
Lead to Won" step 6 ("the single riskiest spot"). Verified end-to-end in
production code with the walkthrough's own ZZ Test script (both windows,
public sign, brand-new account):

- **Deposit auto-seeds on entering Committed** (both paths — manual move and
  public signature): 10% of the deal value, rounded to $100, min $500. No deal
  parks behind an unset "set the amount to start the clock" row anymore; staff
  can still change the amount via the deposit API before marking it sent.
- **"When the deposit clears" card now lists the actual phases** the project
  will be born with — derived live (signed option → recommendation → first
  option; lump-sum = one phase at the option price; no proposal = one "Full
  engagement" phase at the deal value), so the list is never empty. A deal with
  no signed proposal shows an amber mono note and Create project stays enabled.
- **Create project no longer requires an approved proposal** — any Committed
  deal can finish the loop. The AI still writes the SOW (scope + deliverables),
  but the phase skeleton is now forced from the signed option: **right names,
  right amounts** land on the project's phases (walkthrough step 7 check 1).
- **Phase 1 opens paid at its full proposal amount** when the deposit cleared
  (the deposit is its payment record — step 7 check 2); later phases are born
  priced from the proposal and follow the normal quote/pay gates. Without a
  cleared deposit (admin force), phases are born draft — no phantom payments.

Walkthrough results on the remaining checks: deal lands in Won and leaves the
pipeline columns (it shows in the Won strip by design), account flips to
Client, and the portal-invite prompt appears after Create project. The two new
canvas files (Production Walkthrough, Proposal Focus — Options) are now
committed alongside the handoff folder for reference.

---

# Update — 2026-07-09 (Opportunities restructure, Round 1 — the model)

Implements HANDOFF-DELTA-2026-07-09 §§1–3, 6, and the §5-adjacent plumbing. The
reference build is v3; Round 2 (Contacts nav page, dossier chips, training
strip, spine polish) follows separately.

- **One pipeline, lead/Triage retired.** Board columns are New → Discovery →
  Proposal out → Negotiating → Committed; an opportunity is the deal record at
  stage `new` with the blue ◔ OPPORTUNITY badge (◭ DEAL purple after). Cards in
  New carry "Accept → start Discovery" (same record, stage flips, badge flips);
  the drawer shows a 5-step stepper ("stage 1 of 5") and gates proposal work
  until acceptance. Nav says **Opportunities** with a new-opportunity badge;
  the staff Home pipeline card counts "N new opportunities to accept".
- **People-first model.** `deals.organization_id` is now nullable (as are
  proposals / process events / audit rows): every opportunity attaches to a
  contact from day one, account optional. **Account-less deals run the whole
  loop** — proposals send (public page says "prepared for {contact}"), signature
  lands them in Committed with the deposit auto-seeded (account-level agreement
  docs wait), and **Create project → births the account** from the contact's
  name: contact linked as primary, deal + proposals + history re-linked,
  agreement package seeded on the newborn account. Verified end-to-end.
- **Entry points.** "+ New opportunity" (contact picked or created inline,
  account existing/new/none, "What do they need" seeds the name + discovery
  note, est value / source / owner) and "+ New contact + account" (no
  opportunity; **portal invitation goes out on create** when there's an email
  and an account — §3's deliberate reversal of the 08 Jul invite timing; the
  acceptance automation is unchanged and verified). Contact pages get
  "+ Start opportunity". The capture modal is deleted.
- **Data migration:** every existing to_qualify contact converted into an
  opportunity at `new` (name, est value, owner, intake note travel); the
  unaccepted-opportunity SLA nudge replaces the triage-overdue one.
- **Probabilities note:** the delta lists 10/25/55/75/90 but no v3 surface
  renders them. We anchored `new` at 10% in the same admin-tunable
  probability-anchor system the board columns already show (≈N% close in each
  column header + the weighted pipeline stat). If design draws a dedicated
  weighted treatment, we'll match it.

---

# Update — 2026-07-09 (fix: Contacts top-level page — delta §4, HANDOFF-FIX)

The restructure's §4 had been deferred to Round 2; production QA proved it isn't
deferrable — created contacts were invisible. Shipped per the fix spec:

- **Contacts** nav entry (staff, between ◆ Proposals and Accounts, no badge) →
  `/dashboard/contacts`: intro line (exact copy), table per the prototype
  (avatar + name with `{title} · {email}` sub-line / Company with a muted
  "no account yet" — never blank / Opportunities count or `—` / Source /
  chevron), whole row → the existing contact workspace. Real empty state.
- **Post-create navigation:** the New-contact confirmation now reads
  "Done → Contacts" and lands on the list — creation never ends on a surface
  where the record can't be seen.
- `listContactsLite` extended with title, source, and per-contact opportunity
  count (grouped over `deals.primaryContactId`); pickers unaffected.

Acceptance script re-run verbatim: inline-created contact shows with count 1;
bare name-only contact shows with "no account yet" and `—`, row opens the
workspace with + Start opportunity. The dedicated full-width
`/dashboard/contacts/[id]` detail page from the prototype remains the Round-2
ideal end state, as the fix note allows.

---

# Update — 2026-07-09 (founder copy call: board header)

The Opportunities page header is now eyebrow **Leads** / h1 **Opportunities**
(was Opportunities / Pipeline). Founder's direct instruction — note it uses
"Leads" as the page eyebrow even though the restructure retired "lead" as a
vocabulary term; if that conflicts with v3's intent, raise it with him rather
than reverting.

# Update — 2026-07-09 (founder calls: Team page promoted to nav, board de-clutter, collapsible Won/Lost)

Three founder-directed changes to the Opportunities surface and nav:

1. **Team is a top-level nav item now**, sitting **below Settings** (admin-only,
   like Settings). It renders at `/dashboard/team` as a normal page inside the
   app shell — kicker **Team**, h1 **Process scorecard** — no longer a full-screen
   layer over the sales board, so the "← Board / Esc closes" chrome is gone. The
   old `/dashboard/sales/team` URL redirects. The **"Team →" link was removed
   from the Opportunities board header** (header is now: Leads/Opportunities +
   filter chips · ▦/☰ toggle · + New opportunity).
2. **List view section kicker** renamed **Pipeline → Opportunities** (the board's
   "Open pipeline" money stat keeps its name — it's a metric, not a section).
3. **Won and Lost swimlanes are expand/collapse capable.** Board view: each
   zone's header row (dot · Won/Lost · count pill · $ sum) is now a click target
   with a ▾/▸ chevron at the right; collapsed = header row only, and it still
   works as a drag-drop target. State persists per browser (localStorage). List
   view: the green Won strip header toggles its deal rows the same way.

# Update — 2026-07-09 (lost = read-only post-mortem · contact detail page)

Two founder-directed rounds, shipped together:

1. **Lost deals are a read-only record now.** Opening a lost deal's drawer:
   - A red-bordered **"Why we lost it"** card takes the prime slot directly under
     the name/value (LOST pill · "auto post-mortem · read-only record" caption),
     rendering the auto post-mortem; if none was generated it says the reason
     lives in the deal history. The old lower post-mortem section moved up here.
   - **No creation paths anywhere**: "◆ Rough out a draft" / "+ Blank proposal"
     are gone (an existing proposal keeps its read-only "View full proposal →"
     shortcut; a declined one keeps "Read it →" without the "start the next one
     below" nudge). Contact block, deal record, discovery distill, and meeting
     cards all render read-only. Stage actions/footer were already hidden for
     terminal stages.

2. **Contact detail page** — `/dashboard/contacts/[id]`, per the founder's
   screenshot of the v3 Contacts detail screen. Contacts-list rows now land here
   (the drawer workspace at /dashboard/sales/contacts/[id] still exists for the
   dump/scout tooling). Layout: ink motto strip ("people first — …"), ← Contacts
   breadcrumb, avatar + name + company + mono "via {source} · ✉ invited to the
   portal" subline, "+ Start opportunity" (always available). Two columns:
   - **Details — edits apply everywhere**: Name / Email / Role / Source inputs
     with an explicit Save (shared record; PATCH /api/contacts/[id]).
   - **Portal access**: state pill (Not on the portal / Invited — no login yet /
     On the portal / Access disabled) + **Resend invite** (re-sends the magic
     link) or **Invite to portal** when eligible; mono caption explains the state.
   - **Company**: account select — attaching links both ways (sets the current
     account AND a contact_companies row; new `action: "attach_account"`);
     "Open {account} →" link; detach = "no account yet".
   - **Opportunities** card: every deal starting from this contact — stage dot
     (green won / red lost / cobalt open), name → deal drawer, stage · value.

# Update — 2026-07-09 (founder call: no auto-invite on contact create)

Reverses the delta §3 invite-on-create decision (restoring the 08 Jul timing —
the invite is deliberate, not automatic):

- **Creating a contact never sends a portal invitation.** The `contact.invited_on_create`
  path is deleted from the service; the New-contact modal's cobalt note now reads
  "✉ No invitation goes out yet — you'll land on the contact's page, where sending
  the portal invite is the suggested next step."
- **Create lands on the contact page.** The modal's done-state confirmation is gone;
  a successful create navigates straight to `/dashboard/contacts/[id]`.
- **Portal access = the emphasized next step.** While the contact isn't on the
  portal, the Portal access card takes a cobalt-washed treatment (#FAFBFF bg,
  1.5px #C9D0FB border), a cobalt **NEXT STEP** chip beside the kicker, and a
  cobalt **✉ Invite to portal** button; the mono caption spells out what's missing
  ("no invite went out on create — add an email above / attach an account below /
  send it when you're ready"). Once invited, the card returns to the quiet white
  treatment with the amber "Invited — no login yet" pill + Resend invite.
- Acceptance automation is unchanged — when they do accept, the login links to the
  contact by email.

# Update — 2026-07-09 (nav copy: "◆ Proposals" → "Proposals")

The diamond glyph is gone from the Proposals nav item — plain "Proposals",
matching the rest of the sidebar. (◆ elsewhere still means "AI-assisted".)

# Update — 2026-07-09 (Accounts: + Add account replaces the onboard panel)

Founder call: the "Onboard an account" side panel (company + primary contact +
email + invite on submit) is **retired** from /dashboard/accounts. In its place:

- **"+ Add account"** button in the page header (admin / account owner) opening a
  modal: account name · account owner select · optional intake notes · and an
  **"Attach existing contacts"** searchable checkbox list — the "two standalone
  people, now their company exists" flow. Account-less contacts sort first
  ("no account yet"); picking someone already on another account shows an amber
  "moves from {account}" note. Attaching links both ways (current account +
  contact_companies row). **No invites are sent from this flow** — invites stay a
  deliberate step on each contact's page. Create lands on the new account's page.
- Backend: `POST /api/accounts` → `createAccount` in services/clients.ts (org born
  prospect, `account.created` audit). The old `POST /api/clients` onboard+invite
  endpoint still exists but has no UI.

# Update — 2026-07-09 (b) — Stage follows the proposal (HANDOFF-DELTA-2026-07-09b)

Implements the 09b delta in full — **Proposal out is event-driven, not a button**:

- §1 **No manual advance out of Discovery.** The deal drawer's black "Move to
  Proposal out" button is gone — Discovery shows a dashed cobalt hint chip
  ("Sending the proposal moves this deal to Proposal out automatically.") with
  **Mark lost** unchanged beside it; the caption reads "the nudge is never a
  gate…". Dragging a Discovery card onto the Proposal-out column bounces with an
  inline note instead of moving. (The ☰ List view and Deal-record disposition
  SELECTS still allow any→any as logged corrections — flag if v3 wants those
  narrowed too.)
- §2 **Send advances the deal.** `sendProposal` moves a `new`/`discovery` deal to
  `proposal_out` in the same transaction (status sent + share token + supersede +
  stage move + `deal.stage_changed via proposal.sent` audit) and returns
  `movedToProposalOut`. Editor toast: **"Sent — deal moved to \"Proposal out\""** /
  "Sent — share link is live".
- §3 **The readiness nudge fires on Send.** Clicking Send with readiness < 7 +
  training mode opens the frame-39 modal in its new send variant: body "…sending
  this proposal now risks a pitch built on gaps.", recommendation **"Recommended:
  hold the send."** (follow-up call with the named decision-maker — the draft
  keeps), cobalt **"Hold the send · stay in Discovery"** · ghost **"Send anyway"**
  · caption "the nudge is never a gate — overrides are logged to the deal".
  Hold → toast "Held — the draft keeps, deal stays in Discovery". Send anyway →
  override logged to process_events (surface `proposal_send`) then the full §2
  send path. Training OFF below the bar = quiet variant on Send: it sends, logs
  the override, and the toast carries "⚠ below proposal-ready (x/10), logged to
  the deal".
- §4 Discovery "Next step" copy now ends "…Sending it moves this deal to Proposal
  out." The board-drag and drawer-move nudge triggers are deleted (frame 39
  trigger superseded per the delta's supersession map).

# Update — 2026-07-09 (DEV TOOL: hard-delete a deal from the drawer)

Temporary, deliberately quiet chrome (same pattern as the contact/account dev
deletes): admins get a grey mono "🗑 delete" in the deal drawer's title row at
ANY stage. Confirming hard-deletes the deal + proposals/options, discovery
package, logged calls, process events, and the agreement checklist; meetings
keep their calendar mirror but lose the deal link; the contact and account stay.
Deals that already created a project are refused (use the account dev tools).
This exists so walkthroughs can be redone on the same data — **the product path
remains "Mark lost with a reason"**, and these buttons come out once the system
settles (do NOT design around them).

# Update — 2026-07-09 (proposal spine: progress rail + full height)

Two founder polish calls on the proposal editor's ink spine, matching the
prototype screenshot:

- **Full height:** the grid's `align-items: start` is gone — the ink column now
  stretches to the full height of the content beside it, whatever the page
  length (content stays top-aligned).
- **Progress rail:** when the chosen/recommended option has phases, a 2px
  `#2c2f36` connector line runs vertically behind the step dots (master
  signature ✓ → numbered phase dots), each dot ringed with an ink halo so the
  line passes cleanly behind it. The hard border-bottom separators between
  master signature and phases are gone (the rail is the connective tissue);
  **Eligible approvers** keeps a 1px rule above it. Single-delivery proposals
  (no phases) render no rail.

# Update — 2026-07-09 (fix: "Mark recommended" card never turned green)

Founder QA: clicking Mark recommended saved correctly (the spine updated) but the
option card's green treatment never changed. Cause: the cards render from a local
editing snapshot (for autosaved typing) that was initialized once and never
reconciled after PATCH + refresh. Fixed: after any structural change (recommended
flag, option add/remove, rename) the server truth is merged back into the local
copies — in-flight typed prices/notes are preserved. Toggling now flips the green
card, the RECOMMENDED label, and the letter tile immediately, on the right option.

# Update — 2026-07-10 (Mark recommended is optimistic now)

Founder feedback: toggling Recommended took 2–3s — the UI waited for the PATCH
round-trip AND a full server re-render (router.refresh) before painting. The
toggle is now optimistic: the green card / RECOMMENDED label / letter tile flip
instantly (mirroring the server's single-select + click-to-unmark semantics),
the save lands in the background, and a failed save visibly reverts with the
error line. The background refresh still truth-ups the page. Other controls
keep the wait-for-server pattern for now — a broader perceived-latency pass
(optimistic board drags etc.) is a known candidate, not yet scheduled.

# Update — 2026-07-10 (the MSA is a real document now)

The founder's MSA boilerplate (docs/MSA.docx) is in the product as **template
v1.0** (`src/domain/msa.ts` is the single legal source of truth — edits happen
there and bump the version):

- **Where it fits:** the MSA is the ACCOUNT-level umbrella — relationship terms
  signed once per client. Money/scope stay in the per-deal proposal + SOW, which
  ride on top (§1 order of precedence in the doc itself). This matches the
  existing model: `msa` agreement rows are account-level, and repeat deals go
  "MSA on file · SOW only".
- **Auto-population:** `/dashboard/accounts/[orgId]/msa` renders the boilerplate
  merged with live account data — client name in the preamble + signature block,
  effective date (signedAt when signed, else today), Wahala signer = account
  owner, client signer = the account's primary contact (+ title). Blank rule
  lines where a field is unknown. Print / save-PDF button; print CSS strips the
  chrome so it prints as a clean paper document.
- **Surfaces:** the deal drawer's agreement package (seeds at Committed) shows
  **View doc →** on the MSA row (needed/sent AND signed states); the Account
  page's Agreements rail shows **doc →** on its MSA row. Status banner on the
  doc mirrors the row: needed ("send this, then mark sent") / sent / signed
  ("on file account-wide — SOW only from here").
- Rendering is on-demand from live data — the executed copy (DocuSign round,
  pending Jason) remains the signed source of truth. No schema change.

# Update — 2026-07-10 (agreement rows: Signed is a pill that fills in place)

Founder QA on the Committed drawer's agreement package: the old "✓ Signed"
GREEN TEXT action read as if the doc was already signed, and clicking it swapped
the whole row for a different grey "done" shape. Reworked to ONE row shape for
every status:

- The left checkbox circle never moves — empty 1.5px `#D7D9DF` ring while open,
  filled green ✓ (`#DCF5E3`/`#15803D`) once signed.
- **"Signed" is a pill now**: neutral outline (white bg, `#D7D9DF` border, muted
  text) while unsigned; clicking fills it green in place (`#DCF5E3` bg,
  `#BFE6CC` border, "✓ Signed") — clicking the green pill undoes (tooltip says
  so). No more disappearing row or separate "undo" text.
- "Mark sent →" and "n/a" render only while unsigned; the MSA "View doc →" link
  stays in every state. The signed row keeps the quiet `#FBFBFC` tint and the
  "signed {date}" mono subline.
- The deposit row is unchanged (it keeps its own paid/warning treatment).

# Update — 2026-07-10 (Send/Sent + Paid join the pill treatment)

Follow-on to the Signed pill: the whole agreement package now uses one pill
language (`pillStyle` helper in ContractRoom — outline while pending, fills in
place when done):

- **Agreement rows:** "Mark sent →" text link is gone. An outline **Send** pill
  fills amber **✓ Sent** in place; clicking the amber pill undoes back to
  needed (a doc can bounce). Order on an open row: Send/Sent pill · Signed pill
  · mono n/a.
- **Deposit row keeps ONE shape** whether unpaid or paid (the grey doneRow swap
  is gone): the ⚠ amber circle flips to a green ✓, the amber wash flips to the
  quiet #FBFBFC tint, subline becomes "paid {date}". Outline **Send** → amber
  **✓ Sent** (tooltip carries the sent date), outline **Paid** → green
  **✓ Paid**. Deposit pills do NOT toggle back — the bookkeeping API is one-way
  (markSent/markPaid); filled deposit pills render as static chips.
- doneRow is fully retired from the contract room.

# Update — 2026-07-10 (SOW page: explicit "← Back to proposal")

Founder QA: no visible way back from the contract/SOW page. The mono breadcrumb's
deal-name link existed but wasn't discoverable — a cobalt "← Back to proposal"
link now sits directly under the breadcrumb, above the document.

# Update — 2026-07-10 (Tasks: visibility toggle + delete any task)

Founder QA on the phase page's Tasks section, two gaps:

- **Visibility is now editable after creation.** For admins/leads, the static
  Client-visible / Internal-only marker on each task row is a clickable pill
  (same colors, trailing ⇄ glyph, tooltip explains the flip). One click flips
  client_visible ↔ internal via `PATCH /api/tasks/:id`; audit-logged
  (`task.visibility`). Clients still see the static marker.
- **Tasks can be deleted at any stage status.** The 🗑 affordance (and the
  service) previously refused past draft ("before the quote is sent") — that
  gate is gone, with a confirm dialog added ("Delete … and its
  subtasks/notes?"). DEV TOOL, same as the deal/contact/account deletes: hard
  deletes come out later in favor of cancel-with-reasoning.

# Update — 2026-07-10 ("with AI" on every AI-triggering button)

Founder preference experiment: any button that fires an AI API call now says so
in its label — "with AI" appended. The ◆ glyph stays as the AI marker; the words
make it explicit. The nine controls:

- ◆ Analyze this contact with AI / ◆ Re-run the scout with AI (contact scout)
- ◆ Distill discovery with AI / ◆ Distill & merge with AI (discovery panel)
- ◆ Ingest call with AI (package extractor)
- ◆ Rough out a draft with AI (proposals card) + "Draft it with AI →" (setup modal)
- ◆ Generate contract / SOW with AI (proposal editor)
- ◆ Draft project with AI → and ↻ Re-draft from sources with AI (project draft flow)
- ◆ Generate tasks with AI (phase page)

Passive/non-generative controls (View contract, ◆ paid discovery chip, autosaves)
are unchanged — the suffix marks generation, not AI-produced content.
