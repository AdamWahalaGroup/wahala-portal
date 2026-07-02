# Auth & onboarding

> Part of the **Wahala Portal** design handoff — see [handoff index](../README.md). Visual reference: the labeled frames in `../Wahala Portal.dc.html`.

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
  and a bold closing line ("Your Wahala representative is {agent}. {agent} will
  contact you shortly to get started on your project.") — no CTAs in the hero); a **What we
  do** 2×2 offerings grid; and a **Your Wahala agent** card — shows the assigned
  agent (set at invite time), states they'll reach out with next steps to scope the
  first project, and offers a **Message {agent}** action that **opens the in-app
  Account thread** (frame 11), not an email client. The hero has no CTAs — it ends
  with a bold line "Your Wahala representative is {agent}. {agent} will contact you
  shortly to get started on your project."
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
