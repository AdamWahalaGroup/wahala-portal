# Setup and operations

This is the maintained setup guide for the Wahala Portal. Commands assume the
repository root and a supported Node.js/npm installation.

## Local application

```sh
npm install
npm run db:migrate:local
npm run db:seed:local  # optional demo data; do not run against production
npm run dev
```

Create `.dev.vars` for local-only values. It is ignored by Git. The commonly
used values are:

```dotenv
DEV_AUTH=true
OPENAI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_SECRET_TOKEN=...
ZOOM_HOST_EMAIL=...
```

`DEV_AUTH=true` bypasses email delivery for local login and must never be placed
in production configuration. Optional integrations remain disabled when their
credentials are absent.

## Cloudflare resources

The application expects bindings declared in `wrangler.jsonc`:

- `DB`: D1 database
- `SESSIONS`: KV namespace for sessions and one-time login tokens
- `FILES`: R2 bucket
- `EMAIL`: Cloudflare Email Sending binding

Non-secret production variables also live in `wrangler.jsonc`. Store secrets
with Wrangler, never in the repository:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put ZOOM_ACCOUNT_ID
npx wrangler secret put ZOOM_CLIENT_ID
npx wrangler secret put ZOOM_CLIENT_SECRET
npx wrangler secret put ZOOM_SECRET_TOKEN
npx wrangler secret put ZOOM_HOST_EMAIL
npx wrangler secret put OPENAI_API_KEY -c cron/wrangler.jsonc
```

Only configure integrations Wahala is ready to operate. Payment and e-signature
providers are not currently authoritative integrations.

## Database changes

Change `src/db/schema.ts`, generate a migration, inspect the SQL, and apply it
locally before testing:

```sh
npm run db:generate
npm run db:migrate:local
```

For production, review and commit the application and migration together. Then:

```sh
npm run db:migrate:remote
npm run deploy
npm run deploy:cron
```

Do not run `db:seed:remote` against production. An additive migration may be
safe before deployment, but migration and application compatibility must be
reviewed each time.

## Verification

```sh
npx tsc --noEmit
npm test
npm run lint
npx opennextjs-cloudflare build
```

Use `npm run preview` for a local OpenNext/Workers preview. See `AGENTS.md` for
repository invariants and `docs/ARCHITECTURE-AND-SECURITY.md` before exposing
real client data or money flows.
