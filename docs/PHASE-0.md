# Wahala Portal — Phase 0 Cloudflare Skeleton

A known-good starting point for **Next.js (App Router) on Cloudflare Workers via OpenNext**, with **D1 (Drizzle) + KV (sessions + magic-link tokens) + R2 (files) + Cloudflare Email (magic-link login) + Stripe test mode**. Everything lives in Cloudflare — no AWS, no external identity provider. Config verified against Cloudflare's current docs (June 2026).

---

## 1. Scaffold the project

```bash
npm create cloudflare@latest -- wahala-portal --framework=next
```

This runs Next.js's own `create-next-app`, then layers in the OpenNext adapter, a starter `wrangler.jsonc`, the `nodejs_compat` flag, and the `preview`/`deploy`/`cf-typegen` scripts. You then extend it with the bindings below.

The scaffold also adds this to `next.config.ts` — leave it; it's what makes your bindings reachable during `next dev`:

```ts
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
```

---

## 2. Create the Cloudflare resources

These commands each print an **id** (or binding block) that you paste into `wrangler.jsonc` in the next step. You don't create any of this in the dashboard.

```bash
# D1 (SQLite) database
npx wrangler d1 create wahala-db

# KV namespace for server-side sessions
npx wrangler kv namespace create SESSIONS

# R2 bucket for files / Zoom recordings
npx wrangler r2 bucket create wahala-files
```

**Email (for magic-link login + invites):** there's no CLI step — onboard your domain once in the dashboard under **Email Sending → Onboard Domain**. That adds the SPF/DKIM/DMARC/bounce DNS records automatically. Your domain must already be on Cloudflare DNS. After onboarding, the `EMAIL` binding works with **no API key**.

---

## 3. `wrangler.jsonc`

Full Phase 0 config. Replace the placeholder IDs with the values printed in step 2.

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "wahala-portal",
  "main": ".open-next/worker.js",

  // Set to today's date; bump deliberately later. 2024-09-23 is the minimum for OpenNext.
  "compatibility_date": "2026-06-25",
  "compatibility_flags": ["nodejs_compat"],

  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "wahala-db",
      "database_id": "<paste id from `wrangler d1 create`>"
    }
  ],

  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "<paste id from `wrangler kv namespace create`>"
    }
  ],

  "r2_buckets": [
    {
      "binding": "FILES",
      "bucket_name": "wahala-files"
    }
  ],

  // Native transactional email — magic links, invites, notifications.
  // No API key. Requires onboarding your domain in the dashboard first (step 2).
  "send_email": [
    {
      "name": "EMAIL",
      "remote": true
    }
  ]
}
```

Notes:
- **Secrets are not in this file.** Stripe keys go in `.dev.vars` locally and `wrangler secret put` in prod (step 8). Auth needs no secrets.
- If you later add ISR pages and want them cached, bind a **separate** KV namespace for the OpenNext cache — do **not** reuse `SESSIONS`.

---

## 4. `open-next.config.ts`

For now this is the entire file:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

You only add an incremental-cache override here if/when you have ISR routes. A mostly-dynamic CRM doesn't, so leave it bare.

---

## 5. `package.json` scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",

    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply wahala-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply wahala-db --remote"
  }
}
```

Mental model:
- `dev` — Next.js dev server in **Node**. Fast reloads, best DX, but **not the real runtime**.
- `preview` — runs in **`workerd`** via Wrangler. Test here before deploying; this is the runtime production uses.
- `cf-typegen` — regenerate `cloudflare-env.d.ts` whenever you change bindings, so `env.DB` / `env.SESSIONS` / `env.FILES` are typed.

---

## 6. Reaching your bindings (the key OpenNext gotcha)

There is **no global `env`**. Inside server code (route handlers, server actions, server components) you get bindings via `getCloudflareContext()`:

```ts
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

export async function GET() {
  const { env } = getCloudflareContext();

  const db = drizzle(env.DB);        // D1
  const sessions = env.SESSIONS;     // KV — sessions + magic-link tokens
  const files = env.FILES;           // R2
  const email = env.EMAIL;           // Cloudflare Email Service

  // Sending a magic link:
  // await env.EMAIL.send({
  //   to, from: `login@${YOUR_DOMAIN}`,
  //   subject: "Your sign-in link",
  //   text: `Sign in: ${url}`, html: `<a href="${url}">Sign in</a>`,
  // });

  // ...
}
```

For statically-evaluated routes, use the async form: `await getCloudflareContext({ async: true })`.

**Middleware caveat:** OpenNext supports edge middleware, but **Node.js-runtime middleware (Next 15.2+) is not yet supported**. If you put auth checks in `middleware.ts`, keep them edge-compatible (no Node APIs). Heavier auth logic belongs in route handlers, not middleware.

---

## 7. Drizzle + D1

Install:

```bash
npm i drizzle-orm
npm i -D drizzle-kit
```

`drizzle.config.ts` (generate-only — migrations are applied through Wrangler, so no remote credentials needed here):

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
});
```

Workflow:
1. Write/edit your schema in `src/db/schema.ts` (Drizzle SQLite tables).
2. `npm run db:generate` → drizzle-kit writes SQL into `./drizzle/migrations`.
3. Apply to D1 with `wrangler d1 migrations apply` (local then remote).

**One seam to confirm in code:** drizzle-kit's generated SQL and Wrangler's migrations directory need to line up. Easiest path is to set Wrangler's `migrations_dir` to `./drizzle/migrations` in `wrangler.jsonc`, or apply generated SQL directly with `wrangler d1 execute wahala-db --file=...`. Verify the current glue when you wire it — this part of the Drizzle↔D1 story moves between versions.

At runtime you always connect with `drizzle(env.DB)` from `drizzle-orm/d1` (stable).

---

## 8. Secrets (Stripe only)

Auth needs **no** secrets — magic links use the native `EMAIL` binding (no API key) and sessions live in KV. The only Phase 0 secrets are Stripe's.

Local dev — create `.dev.vars` in the project root (**gitignore it**):

```
# .dev.vars  — local only, never commit
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SESSION_SECRET=xxx        # optional — only if you sign the session cookie
```

Production — push each as a real secret:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Access them the same way as bindings: `getCloudflareContext().env.STRIPE_SECRET_KEY`.

> If you ever swap Cloudflare Email for **Resend** (more mature, out of beta), that's the *only* place a secret re-enters auth: add `RESEND_API_KEY` here and replace the one `env.EMAIL.send(...)` call with a `fetch()` to Resend. Nothing else changes.

---

## 9. First run

```bash
npm run dev        # iterate
npm run preview    # verify in the real workerd runtime
npm run deploy     # ship — appears under Workers in the dashboard
```

---

## What's intentionally NOT here yet

- **Auth flow** — magic-link request → email a one-time token (KV, short TTL) → verify → mint a KV-backed session cookie. No passwords, no external identity provider.
- **The scoped-query helper** — the single enforcement layer (`organization_id` + role + `internal_only`) every client-scoped read goes through.
- **Schema** — Project → Stage → Task, immutable acceptance/approval records, audit log.
- **Stripe webhook handler** — signature-verified, idempotent, unlocks a stage.

Those are the first application-code pieces to build on top of this skeleton.