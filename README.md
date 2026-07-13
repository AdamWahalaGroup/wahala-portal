# Wahala Portal

Internal **CRM + client portal** for **Wahala Group**, an engineering consulting
company. It runs product licensing/handoff, modernization, custom builds, paid
discovery, advisory, and support from first opportunity through delivery.

Start with [`docs/OPERATING-MODEL.md`](docs/OPERATING-MODEL.md),
[`docs/SALES-PROCESS.md`](docs/SALES-PROCESS.md), and
[`docs/ROADMAP.md`](docs/ROADMAP.md). [`docs/README.md`](docs/README.md) is the
index for all maintained documentation.

## Core model

- **Account → Contacts → Deals → Projects** — an opportunity is a Deal at `new`;
  “deals in progress” is a view of its open stages.
- **Project → Stages → Tasks** — a one-shot engagement has one paid Stage; a
  phased engagement has several.
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
| Payments | Manual marks today; hosted checkout/webhooks are roadmap work |
| AI | Internal, human-gated drafts/suggestions; current runtime uses OpenAI APIs |

## Status

Internal-pilot application with the sales funnel, discovery, proposals,
agreements, project delivery, client portal, and bounded Deal Pulse implemented.
It is not yet the authoritative system for binding signatures or reconciled
payments.

## Getting started

```sh
npm install
npm run db:migrate:local
npm run dev
npx tsc --noEmit
npm test
npm run lint
npx opennextjs-cloudflare build
```

See [`docs/SETUP.md`](docs/SETUP.md) for local configuration, migrations,
Cloudflare bindings, and deployment order. The data model lives in
[`src/db/schema.ts`](src/db/schema.ts).

See [`AGENTS.md`](AGENTS.md) for repository invariants and verification commands
used by Codex and other contributors.

## Repo layout

- `docs/` — current business, sales, architecture, setup, and roadmap guidance
- `src/db/` — Drizzle schema (the data model) + D1 client
- `src/app/`, `src/middleware.ts` — Next.js app (magic-link auth flow built in Phase 1)
- `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`, `drizzle.config.ts` — Cloudflare/OpenNext/Drizzle config
