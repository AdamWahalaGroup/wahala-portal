# Interface patterns and constraints

> Maintained interaction reference. The [operating model](../OPERATING-MODEL.md),
> [sales process](../SALES-PROCESS.md), and server-side policies take precedence.

## Server Component vs Client Island
| Component | Type |
|---|---|
| StatusBadge, Stepper, Money, HistoryTimeline | **server** |
| WaitingOn, VisibilityMarker, PeopleCard | **server** |
| ActionBar (the allowed-action set) | **island** |
| ConfirmDialog (pay / accept / reject / co-sign) | **island** |
| LineItemEditor (quote builder) | **island** |
| AcceptanceChecklist, FileUpload, MessageComposer | **island** |

Prefer server components for data loading and initial rendering. Use client
components only for interactions that require browser state. Authorization and
the legal action set remain server-computed regardless of component type.

---

## Interactions & Behavior
- **Phase lifecycle (state machine):** upfront billing follows `draft → quoted →
  approved → paid → in_progress → delivered → accepted`. On-delivery billing
  starts work after approval and requires payment before acceptance. Rejection,
  redraft, and revision are explicit branches. Deals run the separate New →
  Discovery → Proposal out → Negotiating → Contracting lifecycle. **Phase** is a
  delivery unit; **Stage** is a Deal disposition.
- **Action set is server-computed** from role + state (+ threshold). The UI renders
  exactly that set — never invent or client-side-gate actions.
- **Confirm steps** required for weighty actions: pay, accept, reject, request
  revision, send-over-threshold.
- **Responsive:** staff screens may be desktop/data-dense; client
  approve/pay/accept flows must be excellent on a **phone**.
- **States to implement per screen:** idle, loading, empty, error, and
  **no-permission**, plus role variants (staff vs each client role).

## State Management
- Auth/session (magic-link, KV) → current user + role.
- Current org (clients locked to one; staff may switch).
- Per-phase: status, **deliverables (grouped by epic)**, fixed price, payment state,
  **tasks → subtasks + notes worklog**, **change orders** (own status), history,
  allowed-action set.
- Optimistic UI in islands is fine, but the **server is authoritative** for state
  transitions and permissions.
- **Auto-refresh (behavioral):** Clients, stage, dashboard, and Messages views poll
  ~8s while something is pending (e.g. an invite outstanding) so cross-session
  changes appear live — no manual refresh, no dedicated visual.

## Vocabulary (use consistently across the UI)
- **Phase** = a priced unit of project delivery with an explicit billing mode —
  this is the object the old "Stage" name referred to. **Stage** now belongs
  exclusively to the deal pipeline (New → Discovery → Proposal out →
  Negotiating → Contracting). **Phases belong to projects, Stages
  belong to deals — never mix the two up in code, routes, or copy.**
- **Deliverable** = a client-facing scope item (renamed from "line item"; amount
  optional/illustrative). Deliverables group under **Epics**. Internal **Tasks**
  hang under a deliverable and carry **Subtasks** (checklist) + **Notes**
  (worklog). A **Change order** is the client's/staff's "request a change"
  object with its own Requested→Quoted→Approved→Paid→Applied (or Declined) gate.
- **Payment state is currently administrative, not processor-confirmed.** Do not
  design copy that implies reconciled payment or final accounting authority.

## Non-negotiable functional constraints
1. **Role + state gating** — render only allowed actions (server returns the set).
2. **The configured payment gate is a wall** — upfront work cannot start unpaid;
   on-delivery work cannot be accepted unpaid. Show the actual billing mode.
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

## Implementation note

Prefer existing components and tokens in the application over recreating an old
prototype. When a new pattern is genuinely durable, add it here in the same
change as the implementation.
