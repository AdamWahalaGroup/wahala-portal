# Phase 0 — Setup

This is a hand-authored skeleton (Next.js + OpenNext for Cloudflare, Clerk, Drizzle on D1, R2, Stripe wiring). It has **not** been `npm install`ed or built yet — do that below. Versions in `package.json` are recent-as-of-authoring; bump if `npm install` complains.

## Prerequisites
- Node 20+ and npm
- Accounts: **Cloudflare**, **Clerk**, **Stripe** (test mode)

## 1. Install
```bash
npm install
```
If install hits version conflicts, you can regenerate the Cloudflare base with
`npm create cloudflare@latest -- --framework=next` and drop these `src/`, `wrangler.toml`,
and config files back in.

## 2. Cloudflare: log in + create D1 and R2
```bash
npx wrangler login
npx wrangler d1 create wahala-portal          # paste database_id into wrangler.toml
npx wrangler r2 bucket create wahala-portal-assets
npm run cf-typegen                            # generate cloudflare-env.d.ts from bindings
```

## 3. Database migrations (Drizzle → D1)
```bash
npm run db:generate          # schema.ts -> drizzle/migrations/*.sql
npm run db:migrate:local     # apply to local D1
# later, against the real DB:
npm run db:migrate:remote
```

## 4. Clerk
- Create an application; **enable Organizations** (each client company = an Organization).
- Copy keys: put `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local`, and
  `CLERK_SECRET_KEY` in `.dev.vars`.
- Plan the roles (see docs/PLAN.md §4–§5): Wahala admin / account owner / lead engineer /
  engineer, and client admin / user / billing / read-only.

## 5. Stripe (test mode)
- Grab `STRIPE_SECRET_KEY` (test) and a webhook signing secret; put them in `.dev.vars`.

## 6. Run it
```bash
npm run dev        # Next dev at http://localhost:3000 (with CF bindings via OpenNext)
npm run preview    # build + run on the Workers runtime locally
npm run deploy     # build + deploy to Cloudflare
```

## Env / secrets summary
| Value | Where |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` (public) |
| `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` | `.dev.vars` locally; `wrangler secret put` in prod |
| D1 `database_id`, R2 bucket | `wrangler.toml` |

## What's here
- `src/db/schema.ts` — the Phase 1 data model (stages/pay-gate, tasks + visibility, roster, assets). **This is the centerpiece.**
- `src/db/index.ts` — Drizzle client bound to D1.
- `src/app/*`, `src/middleware.ts` — minimal Clerk-wired Next.js app.
- `wrangler.toml`, `open-next.config.ts`, `next.config.mjs`, `drizzle.config.ts` — Cloudflare/OpenNext/Drizzle config.

## Next (Phase 1)
Build the loop: onboarding → assign Account Owner → client account (people/files/history)
→ create project + Lead Engineer + roster → quote an itemized stage (threshold approval)
→ pay (Stripe) → tasks assigned to engineers → deliver → formal acceptance → next stage.
