# Wahala Portal — UI Design Brief

> **Hand-off doc for a Claude Design session.** It captures the product, every
> screen and its states, the domain vocabulary, the component inventory, and the
> hard functional constraints the design must respect. Deeper product context
> lives in [PLAN.md](./PLAN.md); the build so far is in the repo.

---

## 0. Kickoff prompt (paste this first)

> Design **Wahala Portal** — the internal CRM **and** client portal for *Wahala
> Group*, a lean services firm. It's one app with two audiences: **Wahala staff**
> running client work, and **clients** watching that work and approving/paying for
> it. What the firm sells is **accountability and clear communication** — every
> client has a dedicated person, every dollar maps to an itemized scope **paid
> before work begins**, every delivery is **formally accepted**, and every action
> is logged.
>
> Direction: **clean & minimal** (Linear/Stripe-grade restraint — generous
> whitespace, crisp type, a small disciplined palette). **Propose the brand**
> from scratch: a wordmark/logo direction for "Wahala", a color system (neutral
> base + 1–2 accents + semantic status colors), type scale, spacing, radius, and
> elevation. Design **both surfaces as one system** — shared shell + components,
> then the staff and client variants.
>
> The spine of the product is the **pay-as-you-go Stage lifecycle** (§4) — design
> that flow until it's effortless. Respect the **functional constraints in §7**
> (they're non-negotiable: role-aware actions, the pay-gate, visibility, tenant
> isolation). Produce a small design system + high-fidelity screens for §5, with
> empty/loading/error/permission states and responsive behavior.

---

## 1. What this is

An internal **CRM + client portal** for a services firm. Marketed as software
development, but the work can be **any kind of work** — keep it work-agnostic.

- **Staff side (internal console):** run client relationships and deliver work —
  organizations, projects, stages, quoting, tasks, files, comms.
- **Client side (portal):** a durable "account" where a client sees their work
  history, what's happening now, what's **waiting on them**, and where they
  **approve quotes, pay, and accept deliveries**.
- AI assists Wahala staff internally (later) — it is **never** a client-facing
  generator. Out of scope for this design pass.

**Brand:** the company is **Wahala Group**; the product is **Wahala Portal**.
(Some source files historically said "Goliath Lab" — ignore that name.)

---

## 2. Who uses it (roles)

One app, role-scoped. The design must make each role see only what it should.

**Wahala staff** (no client org):
- `wahala_admin` — full access; co-signs over-threshold quotes.
- `account_owner` — owns the **relationship** for their clients (comms, quotes,
  billing, acceptance). Shown on every client-facing screen ("throat to choke").
- `lead_engineer` — owns a project's **delivery**; assigns tasks.
- `engineer` — does assigned tasks; sees **only assigned work**.

**Client users** (belong to one organization):
- `client_admin`, `client_user`, `client_billing`, `client_readonly`.
- Approvals/acceptance are limited to admin/billing; readonly can't mutate.

> **Account Owner vs Lead Engineer** is a core concept: *relationship* owner vs
> *delivery* owner. On small projects one person is both — design for both the
> collapsed and the separate case.

---

## 3. The mental model & vocabulary (use these words in the UI)

```
ORGANIZATION (a client company = a tenant; the durable "account")
  └── PROJECT (any kind of work; has an Account Owner + a Lead Engineer + roster)
        └── STAGE (the billable unit — paid IN FULL before work starts)
              ├── LINE ITEMS (itemized scope = the quote AND the acceptance checklist)
              └── TASKS (internal breakdown; assigned to engineers — or to the
                          client as an "on you" action item)
```

- **Stage** = the client-facing billable piece. Clients pay one stage at a time.
- **Change order** = an out-of-scope re-quote (same approve→pay gate as a stage).
- **Waiting on whom** = every thread/item is flagged *Waiting on you* vs *Waiting
  on Wahala*. Surface this everywhere — it's central to the "clear communication"
  promise.
- **Visibility** = each task/file/message is **client-visible** or **internal**.
  Clients must never see internal items (meeting recordings, AI digests, internal
  notes, cost/margin).

---

## 4. The Stage lifecycle — the heart of the UI

Design this until it feels inevitable. It's a state machine; **the pay-gate is a
hard wall — no delivery before payment.**

```
 draft ──send quote──▶ quoted ──client approves──▶ approved ──PAYS in full──▶ paid
   ▲                     │                                                      │
   │                     └─client rejects─▶ rejected ─re-draft─▶ draft          │ start work
   │                                                                            ▼
   └────────────────────────────────────────────────  in_progress ◀─resume─┐  
                                                            │               │  
                                                       deliver              │  
                                                            ▼               │  
                                                        delivered ─needs revision─┘
                                                            │
                                                   client ACCEPTS (logged)
                                                            ▼
                                                        accepted  (terminal; next stage = new one)
```

**The 9 statuses** (design a distinct, semantic badge for each — current
placeholder colors in parens; refine but keep meaning legible at a glance):

| Status | Meaning | Placeholder |
|---|---|---|
| `draft` | being scoped | grey `#6b7280` |
| `quoted` | sent to client, awaiting approval | blue `#2563eb` |
| `approved` | client approved; **awaiting payment** | violet `#7c3aed` |
| `paid` | paid in full — work may begin | cyan `#0891b2` |
| `in_progress` | being delivered | amber `#d97706` |
| `delivered` | done; awaiting client acceptance | teal `#0d9488` |
| `accepted` | formally accepted (logged) ✓ | green `#16a34a` |
| `needs_revision` | client asked for changes | red `#dc2626` |
| `rejected` | quote rejected | red `#b91c1c` |

**Who acts, and when** — the UI shows **only the actions allowed for the
viewer's role in the current state** (the server computes this set):
- Staff (admin/owner): *send quote*, *re-draft*. Over the **$ threshold**, only a
  **Wahala admin** may send (co-sign) — surface this gate.
- Client (admin/billing): *approve quote*, *reject quote*, *accept*, *request
  revision*.
- Staff (admin/lead): *mark paid* (interim; becomes Stripe), *start work*,
  *resume work*, *deliver*.

Design a prominent **stage progress / stepper** so anyone lands and instantly
knows where the stage is, what's next, and who's holding the ball.

---

## 5. Screens to design

✅ = exists today as bare scaffolding (replace it). ◻︎ = upcoming (design the IA
now so it has a home).

### ✅ Login
Magic-link only (no passwords). Flow: enter email → "check your email" → (click
emailed link) → lands in app. States: idle, sending, sent, error. Keep it
calm and trustworthy; this is the first impression.

### ◻︎ App shell / navigation
Persistent shell: brand, primary nav (differs staff vs client), org context, the
**Account Owner** surfaced on client screens, user menu, sign out. Staff may need
an **organization switcher**; clients are locked to their one org.

### ✅ Dashboard / home (two variants)
- **Staff:** portfolio overview — clients/projects, what needs attention (quotes
  to send, payments awaited, deliveries to accept), "waiting on Wahala" queue.
- **Client:** their projects, current stage status, **"on you" action items**
  (approve / pay / accept), and what's waiting on Wahala. Currently shows: an
  identity line + a list of projects.

### ✅ Project detail
Project name, status, work type, description; the **Account Owner + Lead Engineer
+ roster**; the **list of stages** (name, amount, status badge); staff/owner get
a "new stage" affordance. Each stage links to its lifecycle screen.

### ✅ Stage detail — **the key screen**
Everything about one stage: name, **status badge**, **amount**, an over-threshold
co-sign flag when present, scope description, **line items**, the **action set**
the viewer may take now, payment state, and a **History timeline** (who did what,
the transition, and when). This is where quote → approve → pay → deliver → accept
actually happens. Make the current state and the single most likely next action
unmistakable. Design confirm steps for the weighty actions (pay, accept, reject).

### ◻︎ Quote / scope builder (staff)
Add/reorder/edit **line items** (the quote = the later acceptance checklist), set
the amount, and send (with the over-threshold admin co-sign path).

### ◻︎ Payment hand-off (client)
From an `approved` stage → Stripe **hosted checkout** (we never handle card
data). Design the "pay this stage" moment and the return/success state that flips
the stage to `paid`.

### ◻︎ Acceptance (client)
Formally **accept** a `delivered` stage **against its line items** (a deliberate,
logged action), or **request revision** with a note. This is a trust moment —
design it with weight and clarity.

### ◻︎ Tasks (delivery)
A stage's tasks with status and **assignee** (a Wahala engineer, or the **client**
as an "on you" item — later an AI worker). Clients see task status + assignees;
**internal-flagged tasks are hidden from clients**. Engineers see only their
assigned work.

### ◻︎ Client account hub
The durable home for one organization: profile & people, the Account Owner, full
**work history**, files, and comms in one place.

### ◻︎ Files / assets
Upload + list, each carrying a **visibility flag**. Client-visible (shared
deliverables, their uploads) vs **internal-only** (recordings, AI digests —
clients never see these). Design the internal marker for staff clearly.

### ◻︎ Messages / comms
Threaded, attributed, each flagged **Waiting on you** vs **Waiting on Wahala**.

### ◻︎ Notifications
Lightweight in-app notifications (later email).

---

## 6. Component inventory (the design system)

- **Stage status badge** — the 9 statuses (§4), semantic + legible small.
- **Stage progress / stepper** — the lifecycle, current step, what's next.
- **Action buttons** — primary / secondary / **destructive** (reject, request
  revision). Show only allowed actions; disabled+reason where useful.
- **Money** — amount display; line-item list and editor.
- **History / audit timeline** — actor, action, state transition, timestamp.
- **"Waiting on" indicator** — *you* vs *Wahala*, used across items/threads.
- **Visibility marker** — *client-visible* vs *internal-only* (staff views).
- **People** — Account Owner card, role chips, assignee avatars.
- **Org context** — org name/header; staff org switcher.
- **Lists & tables, empty states, forms, inline validation, toasts/inline errors,
  confirm dialogs** for weighty actions (pay, accept, reject, send over-threshold).
- **Page shell** — nav, header, content, responsive collapse.

---

## 7. Functional constraints the design MUST respect (non-negotiable)

These come from the domain and the server enforces them — the UI must not imply
anything that contradicts them:

1. **Role + state gating.** Only render the actions a user may actually take in
   the current state. (The server returns exactly this set; the UI mirrors it.)
2. **The pay-gate is a wall.** Work/delivery can never start before a stage is
   `paid`. Never show "start work" / "deliver" on an unpaid stage. Make **Paid** a
   clear, almost-celebrated threshold.
3. **Threshold co-sign.** Quotes over a configurable $ amount require a **Wahala
   admin** to send — surface this state ("needs admin co-sign").
4. **Visibility.** Clients must **never** see internal-only items (recordings, AI
   digests, internal tasks/notes, cost/margin). Internal affordances are
   staff-only and clearly marked.
5. **Tenant isolation.** A client sees **only their own organization's** data.
6. **Formal, logged acceptance.** Accepting a delivery is deliberate and recorded;
   design it as a considered confirmation, not a stray click.
7. **Accountability is first-class.** "Who did what, when" (history) and "waiting
   on whom" should be visible, not buried.

---

## 8. States, responsiveness, accessibility

- **Every screen:** design empty, loading, error, and **no-permission** states,
  plus the **role variants** (staff vs each client role).
- **Responsive:** staff lean desktop (data-dense, efficient); clients often
  approve/pay/accept on **mobile** — those flows must be excellent on a phone.
- **Accessibility:** WCAG **AA** contrast, full keyboard nav, visible focus,
  semantic structure, status conveyed by more than color alone.

---

## 9. Tech context (so designs are buildable)

- **Stack:** Next.js (App Router, **React Server Components**) on **Cloudflare
  Workers** (via OpenNext). Data in Cloudflare D1; magic-link auth; KV sessions.
- **Current UI** is throwaway inline styles — replace entirely. A lightweight
  token-based system (Tailwind or CSS modules + CSS variables) is preferred; keep
  the client bundle small (Workers runtime). Mostly server-rendered pages with
  small **client islands** for interactive actions (buttons, forms).
- **Real routes today** (so designs map to live data):
  `/login`, `/dashboard`, `/dashboard/projects/:id`, `/dashboard/stages/:id`.
  JSON API: `GET/POST /api/projects`, `GET/POST /api/stages`,
  `GET /api/stages/:id`, `POST /api/stages/:id/:action`
  (`send_quote|approve_quote|reject_quote|mark_paid|start_work|deliver|accept|request_revision|...`).

---

## 10. Brand to propose (no existing assets)

Propose a small, disciplined system in the **clean & minimal** direction:
- **Wordmark / logo** direction for "Wahala" (the word means "trouble/hassle" in
  Nigerian Pidgin — the firm *removes* the wahala; a calm, in-control mark fits).
- **Palette:** neutral base, 1–2 brand accents, plus the **semantic status
  colors** (§4) tuned for AA contrast. Avoid a rainbow — restraint.
- **Type:** one strong sans (system-friendly for Workers/perf is a plus), a clear
  type scale, and tabular figures for money.
- **Foundations:** spacing scale, radius, elevation, focus style, motion (subtle).

---

## 11. Out of scope for this pass (but design IA with headroom)

Phase 2+: internal AI meeting/data digests (staff-only), Linear integration,
named Team presets, AI-as-assignee, cost/margin & profit per stage, deep
financial ops, richer notifications. Don't design these now, but leave room for
them in the information architecture (especially the client **account hub**,
**tasks**, **files**, and **comms**).

---

## 12. Deliverables requested from the design session

1. A small **design system**: tokens (color/type/space/radius/elevation) + the
   core components in §6.
2. **High-fidelity screens** for §5 (at minimum: login, both dashboards, project
   detail, **stage detail**, quote builder, acceptance, payment hand-off, tasks,
   files, comms), including empty/error/permission states.
3. **Responsive** behavior for the client approve/pay/accept flows.
4. A short **build note / component spec** mapping designs to the Next.js App
   Router structure in §9 (what's a server component vs a client island).
