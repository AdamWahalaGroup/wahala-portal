# Cross-cutting — architecture, behavior, constraints

> Part of the **Wahala Portal** design handoff — see [handoff index](README.md). Visual reference: the labeled frames in `Wahala Portal.dc.html`.

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
