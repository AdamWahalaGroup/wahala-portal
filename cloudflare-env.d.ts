// Cloudflare bindings + secrets for the Worker runtime.
// Regenerate from wrangler.jsonc with: `npm run cf-typegen`
interface CloudflareEnv {
  // --- bindings (wrangler.jsonc) ---
  DB: D1Database; // Cloudflare D1 (SQLite)
  SESSIONS: KVNamespace; // server-side sessions + magic-link tokens
  FILES: R2Bucket; // files / Zoom recordings
  EMAIL: SendEmail; // Cloudflare Email — magic links, invites, notifications
  ASSETS: Fetcher;
  // --- secrets (.dev.vars locally; `wrangler secret put` in prod) ---
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SESSION_SECRET?: string; // optional — only if signing the session cookie
}
