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
