# Wahala Portal

Internal **CRM + client portal** for **Wahala Group**, a services firm (marketed as software development, but work-agnostic). It runs client relationships and delivers work end-to-end: **staged, pay-as-you-go**, with a dedicated owner per client and transparent, real-time communication.

> 📋 Full build plan: [`docs/PLAN.md`](docs/PLAN.md) · Decisions brief for Jason: [`docs/DECISIONS-for-Jason.md`](docs/DECISIONS-for-Jason.md)

## Core model

- **Project → Stages → Tasks**
  - **Stage** = the piece the client pays for (itemized, prepaid; no work before payment).
  - **Task** = the internal work the Lead Engineer assigns to 1…N engineers (± AI tools).
- **Account Owner** (client relationship) + **Lead Engineer** (project delivery) — one person on small projects, a team on large ones (roster scales 1…N).
- Clients see **live status, who's doing what, and their own "on you" action items**. Internal-only: meeting recordings, AI digests, cost/margin, anything flagged private.

## Stack (decided)

| Layer | Choice |
|---|---|
| Hosting / compute | Cloudflare (Pages + Workers) |
| Framework | Next.js (one repo) via OpenNext |
| Database | Cloudflare D1 (SQLite) + ORM (Drizzle or Prisma) |
| Auth | Clerk (Organizations) |
| Files / media | Cloudflare R2 (with client/internal visibility flag) |
| Payments | Stripe (hosted Checkout/Invoicing) |
| AI (internal, Phase 2) | Anthropic Claude via Cloudflare AI Gateway; Whisper for transcription |

## Status

Phase 0 **skeleton scaffolded** (Next.js + OpenNext/Cloudflare, Clerk, Drizzle on D1, R2, Stripe wiring). Not yet `npm install`ed/built — see setup.

## Getting started

➡️ **[`docs/SETUP.md`](docs/SETUP.md)** — install, create D1/R2, wire Clerk/Stripe, run migrations, run dev.

The data model (the centerpiece) lives in [`src/db/schema.ts`](src/db/schema.ts); see [`docs/PLAN.md`](docs/PLAN.md) §7–§8 for context.

## Open decision

- The **dollar threshold** above which a quote needs Wahala Admin sign-off (business call).

## Repo layout

- `docs/` — build plan, decisions, setup guide
- `src/db/` — Drizzle schema (the data model) + D1 client
- `src/app/`, `src/middleware.ts` — Next.js app (Clerk-wired)
- `wrangler.toml`, `open-next.config.ts`, `next.config.mjs`, `drizzle.config.ts` — Cloudflare/OpenNext/Drizzle config
