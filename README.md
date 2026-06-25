# Wahala Portal

Internal **CRM + client portal** for **Wahala Group**, a services firm (marketed as software development, but work-agnostic). It runs client relationships and delivers work end-to-end: **staged, pay-as-you-go**, with a dedicated owner per client and transparent, real-time communication.

> 📋 Build plan: [`docs/PLAN.md`](docs/PLAN.md) · Phase 0 setup: [`docs/PHASE-0.md`](docs/PHASE-0.md) · Decisions brief: [`docs/DECISIONS-for-Jason.md`](docs/DECISIONS-for-Jason.md)

## Core model

- **Project → Stages → Tasks** — Stage = the piece the client pays for (itemized, prepaid; no work before payment); Task = the internal work the Lead Engineer assigns to 1…N engineers (± AI tools).
- **Account Owner** (relationship) + **Lead Engineer** (delivery) — one person on small projects, a team on large ones (roster scales 1…N).
- Clients see **live status, who's doing what, and their own "on you" action items**. Internal-only: meeting recordings, AI digests, cost/margin, anything flagged private.

## Stack (decided)

| Layer | Choice |
|---|---|
| Hosting / compute | Cloudflare Workers via OpenNext |
| Framework | Next.js (App Router), one repo |
| Database | Cloudflare D1 (SQLite) + Drizzle |
| Auth | Cloudflare **magic-link** (Cloudflare Email + KV sessions) — no external IdP |
| Files / media | Cloudflare R2 (with client/internal visibility flag) |
| Payments | Stripe (hosted checkout + webhooks) |
| AI (internal, Phase 2) | Anthropic Claude via Cloudflare AI Gateway; Whisper (Workers AI) for transcription |

## Status

Phase 0 skeleton aligned to [`docs/PHASE-0.md`](docs/PHASE-0.md) (Workers/OpenNext + D1/Drizzle + KV + R2 + Cloudflare Email + Stripe wiring). Not yet `npm install`ed/built.

## Getting started

➡️ **[`docs/PHASE-0.md`](docs/PHASE-0.md)** — scaffold, create D1/KV/R2/Email, wire Stripe, run migrations, run dev.

The data model (the centerpiece) lives in [`src/db/schema.ts`](src/db/schema.ts); see [`docs/PLAN.md`](docs/PLAN.md) §7–§8 for context.

## Open decision

- The **dollar threshold** above which a quote needs Wahala Admin sign-off (and whether it governs *issuing* a quote vs the client *accepting* one).

## Repo layout

- `docs/` — build plan, Phase 0 guide, decisions
- `src/db/` — Drizzle schema (the data model) + D1 client
- `src/app/`, `src/middleware.ts` — Next.js app (magic-link auth flow built in Phase 1)
- `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`, `drizzle.config.ts` — Cloudflare/OpenNext/Drizzle config
