# Wahala Group — Client Services CRM & Portal — Phased Build Plan

> **Naming:** The source PDFs say "Goliath Lab." The company is **Wahala Group**. Only the original PDF filenames still say "Goliath."

---

## Context

You and your partner **Jason** are starting a services firm — marketed as a software development firm, but the work could be **any kind of work**. This platform is **your firm's internal CRM + client portal**: the single place you run client relationships and deliver work, with **AI as an internal assistant for your team** — never a client-facing generator.

What you're really selling is **accountability and clear communication**: every client gets a dedicated Wahala person, every dollar maps to an itemized scope paid before work begins, every delivery is formally accepted, and every client has one durable "account" holding their whole history and files.

> **Earlier pivots baked in:** dropped the automated AI prototype/POC generator (and with it v0, the code-sandbox problem, free-sample abuse, and the Vercel question). You can still *sell* a proof of concept — your people build it.

| Decision | Settled |
|---|---|
| What it is | Internal **CRM + client portal** for a services firm (work-agnostic). |
| Who builds it | You + Jason, lean, AI-assisted. |
| AI's role | **Internal only** — assists Wahala staff (notably digesting meetings/data). |
| Billing | **Staged pay-as-you-go only** — full payment per stage, upfront, itemized. |
| Accountability | Dedicated **Account Owner** per client; humans approve everything client-facing. |
| Delivery | **Lead Engineer** per project assigns work to 1…N engineers; scales solo → team. |
| Meeting AI | **Phase 2** (after the core loop). |
| Linear | **Optional**, software projects only. |
| Hosting | **Cloudflare** (no Vercel). |
| End goal | Internal tool for Wahala only. Funding undecided — keep costs low. |

---

## 1. Operating model — the pay-as-you-go stage cycle (the spine)

A client **commits to the Wahala process** at onboarding. Their work is a sequence of **Stages**, each paid before it starts:

```
Client requests work ─▶ [Scope & itemized Quote]  (FREE; owner drafts, Phase 2: AI assists)
                              │   (quote over $threshold → Wahala Admin must co-sign)
                              ▼
                    [Client approves] ─▶ [Client PAYS in full] ◀─ HARD GATE: no work before payment
                              ▼
                    [Wahala delivers]  (Lead Engineer + assigned engineers)
                              ▼
                    [Client formally ACCEPTS, per itemized list]  (logged; or "needs revision")
                              ▼
                    [Quote the NEXT stage] ─▶ repeat … until complete
```

- Scoping/quoting is free; everything *delivered* is paid first, in full, per stage.
- Each Stage carries a line-item list — it's the quote, then the acceptance checklist.
- **Hard invariant:** a Stage can't enter "In Progress" until **Paid**.
- Out-of-scope asks = **change orders** (new itemized quote → approve → pay).

---

## 2. The stack (decided)

Principle for two people: **fewest moving parts you can operate yourselves**, staying in Cloudflare.

| Concern | Decision | Note |
|---|---|---|
| Hosting & compute | **Cloudflare** (Pages + Workers) | No Vercel. |
| Framework | **Next.js** (one repo) via **OpenNext** | Separate API later = **Hono**, not Express. |
| Database | **Cloudflare D1** (SQLite) + ORM (Drizzle/Prisma) | Not Postgres; ORM keeps it open later. |
| Auth | **AWS Cognito** (authentication only) | Familiar to the team; orgs/roles owned in our DB. The lone AWS piece — verify JWTs at the edge with `jose`. |
| File/media storage | **Cloudflare R2** + presigned URLs | Stores recordings; carries a **visibility flag**. |
| Payments | **Stripe** hosted + webhooks — **foundational** | Never touch card data. |
| AI (internal) | **Claude** (`claude-opus-4-8`), via **Cloudflare AI Gateway** | Internal only. |
| Transcription (Ph2) | **Cloudflare Workers AI (Whisper)** | Dedicated service later if you need speaker labels. |
| Dev integration | **Linear** — optional, software projects only | Phase 2+. |

---

## 3. The client "account" — the durable hub

Each client company is a tenant with one **account** holding everything:
- **Profile & people** (their users, authenticated via Cognito) + their dedicated **Account Owner**.
- **Work history** — every project, stage, deliverable, payment, acceptance.
- **Assets/files** with a **visibility flag**: *client-visible* (their uploads, shared deliverables) vs. *internal-only* (Wahala's **Zoom recordings** + their Phase-2 AI digests — clients never see these).
- **Communication** — threaded, attributed, each flagged "Waiting on you" vs. "Waiting on Wahala."

---

## 4. Roles & accountability (client-facing)

AI drafts; **humans approve everything client-facing.** Start human-gated, add automation over time.

- **Account Owner** (client's "throat to choke"): owns the *relationship* — comms, quotes, billing, acceptance. Assigned at onboarding and **accepts before any work begins**; visible on every client screen.
- **Threshold price authority:** a non-admin can approve/send quotes **under** a configurable $ threshold; **above** it a **Wahala Admin co-signs**. (You set the figure.)
- **Formal client acceptance:** each Stage ends with the client accepting against the itemized list (or "needs revision"), **logged + timestamped**; acceptance unlocks the next stage.
- **Clear communication:** one source of truth; "waiting on whom" everywhere; every decision logged with who + when; notifications.

---

## 5. Delivery model — leads, engineers, tasks (scales solo → team)

The key to scaling is **one uniform model where team size is just a number (1…N)** — no separate "solo" vs. "team" modes. Two owners, kept separate:

- **Account Owner** = owns the *relationship* (above). **Lead Engineer** = owns a project's *delivery*. On small projects, one person is both (and may be the only engineer).

**Work hierarchy:**
```
PROJECT  (Account Owner = relationship · Lead Engineer = delivery)
  ├── Stage 1   ← the client pays for this piece; accepts against its line items
  │     └── Tasks (internal)  → assigned to Engineer(s) ± AI tools
  ├── Stage 2   ← paid next …
  └── …
Project roster = 1…N engineers   ← a solo dev OR "Team A," same structures
```
- **Stage** = the *client-facing billable piece* (paid one at a time, itemized).
- **Task** = the breakdown the Lead Engineer assigns. **Clients see task status and who's assigned** — real progress and who's doing what. Tasks can also be assigned to the **client** when the ball is in their court, surfaced as a clear **"on you"** action item. A per-task **internal flag** keeps sensitive tasks private when needed.
- **Project roster** = whoever's assigned — one name or five.

**Scaling examples (same tables, more rows):**
- *Small:* roster of 1 — that person is Account Owner + Lead Engineer + sole assignee; one stage, a few tasks.
- *Large:* Lead Engineer + 3 engineers ("Team A") + AI tools; many stages, tasks spread across people.

- **AI agents:** model now as an **"AI-assisted" flag** on tasks (track how much work was AI-aided). Design the *assignee* field flexibly so an AI agent can become a **first-class assignee later** (supports "more automation over time").
- **Teams:** the real primitive is the **project roster**; a named **Team** is just a reusable staffing *preset* — build later, not core.
- **Future (flagged, not now):** time/cost per task → **profit margin per stage**, valuable for a services firm once the task layer exists.

---

## 6. Internal AI — meeting & data digestion (Phase 2)

A Wahala person uploads a **meeting recording**/data to a client account (internal-only). Then, **for Wahala's eyes**: **transcribe** (Cloudflare Whisper, chunk long files) → **summarize + extract** with Claude (key points, decisions, requirements, action items) → **assist scoping** (draft an itemized scope/estimate the owner reviews and turns into a quote — never auto-sent). All outputs internal, human-gated. *(Consent + retention policy required — §12.)*

---

## 7. Data model — on top of the spec's draft

Every tenant table carries `organization_id`. Key tables:
- **`organizations`** + `account_owner_user_id` + assignment acceptance (`assigned_at`, `accepted_at`).
- **`users`** (Cognito-backed via `cognito_sub`) — Wahala staff + client users; roles.
- **`projects`** (any work type; optional `work_type`, optional `linear_project_id`) + **`lead_engineer_user_id`**.
- **`project_members`** — the roster: `project_id`, `user_id`, `project_role` (lead/engineer). 1…N.
- **`stages`**: `status` (Draft→Quoted→Approved→Paid→In Progress→Delivered→Accepted; +Needs Revision/Rejected), `total_amount_cents`, `stripe_ref`, `approved_by_user_id`, `requires_admin_approval`, `paid_at`, `delivered_at`, `accepted_by_user_id`, `accepted_at`. **Invariant: no Paid→In Progress without confirmed payment.**
- **`stage_line_items`** — itemized deliverables (quote + acceptance checklist).
- **`tasks`** — `project_id`, optional `stage_id`/`stage_line_item_id`, `title`, `status`, **`ai_assisted`** flag, **`visibility`** (client-visible by default; internal when flagged).
- **`task_assignments`** — `task_id` + assignee, which may be a **Wahala engineer or a client user** (client action items), and later an AI worker; supports multiple assignees. Clients see status, assignees, and their own **"waiting on you"** items.
- **`change_orders`**, **`assets`** (`type`, `uploaded_by`, **`visibility`**, R2 key), **`digests`** (Phase 2, internal), **`messages`** (+ "waiting on whom"), **audit log**.
- *Optional later:* `teams`/`team_members`; effort/cost fields on tasks.

---

## 8. Phased roadmap

Relative effort (S/M/L/XL). Each phase ends in a demoable milestone.

### Phase 0 — Foundations (S–M)
Cloudflare skeleton (Next.js/OpenNext + Workers); **Cognito** (user pool with a Wahala-staff user + a test client user; orgs/roles in our DB, owner assignment); **D1** + ORM (minimal schema incl. `projects`, `project_members`, `stages`, `stage_line_items`, `assets`); **R2** (visibility flag); **Stripe test payment** end-to-end; **AI Gateway** wired; secrets in Cloudflare. **Milestone:** staff + test-client logins; owner assigned & accepts; test payment flips a record; file uploads with visibility; deploy-on-push.

### Phase 1 — Core CRM + portal + pay-as-you-go loop + delivery layer (L) ← the heart
Run a full lifecycle: onboard → assign **Account Owner** → client account (people, files, history) → create a project → assign a **Lead Engineer + roster** → quote an itemized stage (threshold approval) → client **pays** → Lead breaks the stage into **tasks assigned to engineers** (with status) → deliver → client **formally accepts** → next stage. Plus change orders, threaded comms + "waiting on whom," basic notifications, **real RBAC** (Admin / Account Owner / Lead Engineer / Engineer / client roles), tenant-scoped, with **visibility enforced** (clients see work status, tasks, and assignees, plus their own "on you" action items; recordings/digests/internal-flagged items stay private). **Out of scope:** meeting AI, Linear, deep financial ops, Teams presets, AI-as-assignee, cost/margin. **Milestone:** a real client goes request → paid → delivered (work assigned to engineers) → accepted, entirely in the portal.

### Phase 2 — Internal AI (meeting/data digestion) + dev integrations (L)
Upload a recording → transcript → Claude summary/action-items → **draft scope** the owner turns into a quote (owner-approved, never auto-sent). Optional **Linear** sync for software projects (signed, idempotent webhooks). **Milestone:** owner uploads a client call → clean summary + draft itemized scope.

### Phase 3 — Financial ops + notifications + approvals (M–L)
Invoice/statement history; per-project/stage financials; refunds/voids; design/release approvals; richer in-app + email notifications (transactional email via Resend/Postmark).

### Phase 4 — Scale, polish, more automation (ongoing)
Named **Teams** presets; **AI as first-class assignee**; **cost/margin per stage**; gradually automate human gates; analytics; accounting integrations; better transcription if needed.

---

## 9. Cross-cutting concerns — early vs. defer

| Concern | Get right EARLY | Defer |
|---|---|---|
| **Pay-gate / Stage state machine** | Core from Phase 1; no delivery before `Paid`; server-side. | Deposits/splits. |
| **Visibility (client vs. internal)** | Clients **do** see work status, tasks, and assignees (transparency), plus their own action items. **Internal-only (non-negotiable):** meeting recordings, AI digests, cost/margin, and any task/comment flagged internal. Enforce server-side, test explicitly. | — |
| **Tenant isolation** | `organization_id` everywhere; one enforcement point (ORM middleware/repo). | Row-level hardening. |
| **Role-based access** | **Auth = Cognito; authorization = ours** (orgs/roles in DB). Admin / Account Owner / Lead Engineer / Engineer / client roles; engineers see only assigned work. | Granular per-resource perms. |
| **Human approval gates** | AI output never reaches a client without owner approval; threshold → admin co-sign. | Looser automation (added later). |
| **Payments correctness** | Stripe webhooks: signed + idempotent; reconcile paid↔unlock atomically. | Dunning, proration. |
| **Meeting consent/retention** (Ph2) | Consent to record; retention policy before storing/processing. | Advanced compliance. |
| **Observability / testing** | Logs, Sentry, per-stage/per-digest AI cost; tests on pay-gate, tenant isolation, **visibility**, Stripe webhooks. | APM; broad E2E. |

> **Bulletproof from week one:** (1) no delivery before payment; (2) no cross-client data leaks; (3) **no client sees internal recordings/digests/cost/internal-flagged items** (they *do* see work status, tasks, and assignees); (4) never touch card numbers.

---

## 10. Internal AI assistants (reframed from the spec's 5 agents)

- **Phase 2:** a **Meeting/Data Digest assistant** (transcribe → summarize → extract) and a **Scope/Quote drafting assistant** (draft itemized scope + estimate from request + digests). Both internal, owner-approved.
- **Dev-only, optional:** bug-triage / Linear-handoff helpers — deferred.
- Each = a stateless Claude call with a structured-output schema, persisted; human approves anything client-facing.

---

## 11. Verification — end-to-end per phase

- **Phase 0:** deploy-on-push; staff + test-client logins; owner assign/accept; Stripe test payment flips a record; file uploads with a visibility flag.
- **Phase 1:** request → quote (over-threshold quote **blocks** until admin co-signs) → pay → Lead assigns tasks to engineers → deliver → **acceptance logged** → next-stage quote. Confirm: unpaid stage **can't** start; an **engineer sees only assigned work**; a **client sees task status + assignees + their own "on you" items** but **not** recordings/digests/internal-flagged items; org B can't read org A's data.
- **Phase 2:** upload a recording → transcript + summary + draft scope; (optional) dev project mirrors to Linear.
- **Phase 3:** billing history; approve a design/release; refund/void; notifications fire.

---

## 12. Money & decisions

**Spend that accelerates (funding undecided):** transcription (cheap via Whisper) · transactional email (Phase 3) · a contractor for a bounded slice (Stripe pay-gate, the Cognito auth flow, or Linear sync) if a phase drags.

**Resolved:** CRM (not generator) · Cloudflare/no-Vercel · Next.js · D1 · **Cognito** (auth; permissions self-managed in our DB) · Stripe foundational · staged-only billing · dedicated Account Owner + threshold authority · per-stage acceptance · meeting AI in Phase 2 · Linear optional/dev-only · **Account Owner & Lead Engineer are separate roles (collapse on small projects)** · **clients see work status, tasks, and assignees + their own action items; recordings/digests/internal-flagged items stay private**.

**Still open for you + Jason:** (1) the **dollar threshold** for admin co-sign; (2) Phase-2-time: transcription upgrade vs. Whisper, and a **meeting consent + retention policy**.

---

## 13. Immediate next steps

1. Confirm the §12 items with Jason (mainly the threshold).
2. Stand up the **Phase 0 Cloudflare skeleton** + minimal schema (incl. `projects`, `project_members`, `stages`, `stage_line_items`, `tasks`, `assets`).
3. Build the **Phase 1 core loop + delivery layer**: onboarding → Account Owner → client account → Lead Engineer + roster → stage cycle (pay-gate, threshold approval, tasks assigned to engineers, formal acceptance) → change orders → comms.
4. Then Phase 2: meeting upload → transcribe → digest → draft scope.

---

### Source documents
(Original filenames retain "Goliath"; product is Wahala Group.)
- `Goliath Lab Client Portal - Product Spec.pdf` — vision, roles, flows, billing, data model, MVP scope.
- `Goliath Lab Client Portal.pdf` — stack, services/endpoints, DB schema, permissions, build order.
- Extracted text in scratchpad: `Goliath_Lab_Client_Portal_-_Product_Spec.txt`, `Goliath_Lab_Client_Portal.txt`.
