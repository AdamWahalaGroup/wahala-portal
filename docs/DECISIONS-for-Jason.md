# Wahala Group Platform — Decisions & What I Need From You

**To:** Jason
**From:** [me]
**Status:** I worked your Product Spec + TDD into a phased build plan, and the direction has sharpened. Below is what it **is now**, what's **decided** (with anything touching your TDD flagged), and the **one thing I need from you**.

---

## What we're building (the sharpened version)

**Not** an AI-that-builds-apps. It's **our firm's internal CRM + client portal** — the single place we run client relationships and deliver work. We market as a dev firm, but the tool handles **any kind of work**. **AI is internal-only** — it assists *us* (especially digesting client meetings/data); it's never a client-facing generator.

**We dropped the automated prototype/POC generator** — and with it the AI code-sandbox problem, the free-sample abuse risk, and **the whole v0/Vercel question** (so that's no longer a concern for you). We can still *sell* a proof of concept as a deliverable — our people build it.

**The core loop (our process, which the client commits to):**
scope → itemized quote → **pay in full upfront** → we deliver → **client formally accepts** → next stage. No build-first-bill-later.

**The differentiators:** a dedicated "throat to choke" owner per client, a durable client "account" (their whole history + files), clear logged communication and acceptance, and **internal AI that digests our Zoom calls/data** so we scope and run work faster.

---

## Decided (heads-up on what changes your TDD)

| Area | Decision | vs. your TDD |
|---|---|---|
| Product | Internal **CRM + client portal** (work-agnostic) | Refocus; AI is internal-only. |
| Hosting | **Cloudflare** (Pages + Workers) — no Vercel | You're out on Vercel; we're Cloudflare-centric. |
| Framework | **Next.js**, one repo, via **OpenNext** | TDD was Vite + Express. Separate API (if wanted) = **Hono**, not Express (Express isn't Workers-native). |
| **Database** | **Cloudflare D1** (SQLite) + an ORM | **The one to sanity-check with you:** TDD said Postgres. D1 keeps everything in-Cloudflare with the fewest parts; ORM keeps Postgres open later. Push back if you need Postgres on day one. |
| Auth | **Cloudflare magic-link** (Cloudflare Email + KV sessions) | Fully Cloudflare, no external IdP, no password handling. We own orgs/roles/sessions in the DB. |
| Storage | **Cloudflare R2** + a client-visible/internal **visibility flag** (for Zoom recordings) | Extends your R2 choice. |
| Payments | **Stripe** hosted + webhooks, **foundational** | You had Stripe; moved earlier. |
| AI | **Claude**, internal-only, via Cloudflare AI Gateway; **Whisper** (Cloudflare) for transcription in Phase 2 | TDD was OpenAI. |
| Linear | **Optional**, software projects only (Phase 2+) | Was central; now a dev-only add-on. |

**Operating-model decisions:** staged pay-as-you-go **only** · full payment per phase against an **itemized list** (= acceptance checklist) · **one dedicated Account Owner per client** · **non-admins approve quotes under a $ threshold, admins above** · **per-stage formal acceptance**, logged.

**Delivery model (scales solo → team):** one uniform model where team size is just 1…N. **Account Owner** owns the client relationship; a **Lead Engineer** owns each project's delivery and breaks each paid stage into **internal tasks** assigned to 1…N engineers (collapse to one person on small projects). Hierarchy: **Project → Stages (client pays per stage) → Tasks (internal, assigned to engineers ± AI tools)**. Clients see **work status, tasks, and who's assigned**, plus their own **"on you"** action items (meeting recordings + AI digests stay internal; individual tasks can be flagged internal when sensitive). AI is an "AI-assisted" flag on tasks now, designed to become a first-class assignee later. Named "Teams" and cost/margin-per-stage are later niceties — the core primitive is the project roster.

---

## The one thing I need from you now

**The dollar threshold** above which a quote needs Admin sign-off (a number — your gut + mine).

*(Two more, but they're Phase-2-time, not now: whether to upgrade transcription beyond Cloudflare's built-in Whisper for speaker labels, and our meeting consent + recording-retention policy.)*

---

## Proposed first move

Stand up the **Phase 0 Cloudflare skeleton** (Next.js/OpenNext + D1 + magic-link auth + R2 + Stripe test mode), then build the **Phase 1 core loop**: onboard a client → assign an owner → client account with files/history → quote a stage → pay → deliver → accept. Meeting-digestion AI comes in Phase 2.

*Full plan (phases, data model, verification, cost flags) is in the build-plan doc.*
