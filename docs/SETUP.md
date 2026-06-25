# Phase 0 — Setup

This is a hand-authored skeleton (Next.js + OpenNext for Cloudflare, **AWS Cognito** auth, Drizzle on D1, R2, Stripe wiring). It has **not** been `npm install`ed or built yet — do that below. Versions in `package.json` are recent-as-of-authoring; bump if `npm install` complains.

## Prerequisites
- Node 20+ and npm
- Accounts: **Cloudflare**, **AWS** (for Cognito), **Stripe** (test mode)

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

## 4. AWS Cognito (authentication)
Cognito handles **authentication only**. Organizations, roles, and all access rules live in
our own DB (see `src/db/schema.ts`).
1. In the AWS console, create a **Cognito User Pool**.
2. Add an **App client** with a client secret; note the **Client ID** and **Client secret**.
3. Set up a **Hosted UI domain** (e.g. `wahala.auth.us-east-1.amazoncognito.com`) and add the
   callback URL `http://localhost:3000/auth/callback` (add your prod URL later).
4. Put these into `.dev.vars` (see `.dev.vars.example`): `COGNITO_REGION`, `COGNITO_USER_POOL_ID`,
   `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, `COGNITO_DOMAIN`.

The JWT verification helper is in `src/lib/auth.ts` (verifies Cognito tokens with `jose`). The
login/callback flow + session cookie is the first thing to build in Phase 1 (recommended:
Cognito Hosted UI, OIDC Authorization Code grant).

## 5. Stripe (test mode)
Grab `STRIPE_SECRET_KEY` (test) and a webhook signing secret; put them in `.dev.vars`.

## 6. Run it
```bash
npm run dev        # Next dev at http://localhost:3000 (with CF bindings via OpenNext)
npm run preview    # build + run on the Workers runtime locally
npm run deploy     # build + deploy to Cloudflare
```

## Env / secrets summary
| Value | Where |
|---|---|
| `COGNITO_*` (region, user pool, client id/secret, domain) | `.dev.vars` locally; `wrangler secret put` in prod |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` | `.dev.vars` locally; `wrangler secret put` in prod |
| D1 `database_id`, R2 bucket | `wrangler.toml` |

## What's here
- `src/db/schema.ts` — the Phase 1 data model (stages/pay-gate, tasks + visibility, roster, assets). **This is the centerpiece.**
- `src/db/index.ts` — Drizzle client bound to D1.
- `src/lib/auth.ts` — Cognito JWT verification helper.
- `src/app/*`, `src/middleware.ts` — minimal Next.js app (auth flow to be built in Phase 1).
- `wrangler.toml`, `open-next.config.ts`, `next.config.mjs`, `drizzle.config.ts` — Cloudflare/OpenNext/Drizzle config.

## Next (Phase 1)
Build the loop: onboarding → assign Account Owner → client account (people/files/history)
→ create project + Lead Engineer + roster → quote an itemized stage (threshold approval)
→ pay (Stripe) → tasks assigned to engineers → deliver → formal acceptance → next stage.
Auth: build the Cognito Hosted UI login/callback + session on top of `src/lib/auth.ts`.
