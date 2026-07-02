# Delivery — stages, quote, tasks

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

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

### 09 — Tasks (delivery)
- **Purpose:** A stage's tasks with status + assignee; client "on you" items;
  **internal tasks hidden from clients**; engineers see only assigned work.
- **Layout:** header (title + "Staff view" chip + "+ Task"); table grid
  `1fr 150px 150px 130px` — Task / Assignee (avatar + name) / Status pill /
  Visibility. Internal rows get the `#FAFAFB` tint + `⊘ Internal` marker
  (recording, cost & margin). A footer note restates the visibility rule.
