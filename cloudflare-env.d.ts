// Minimal Cloudflare bindings interface.
// Regenerate from wrangler.toml with: `npm run cf-typegen`
interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  // Secrets (set in .dev.vars locally, `wrangler secret put` in prod):
  CLERK_SECRET_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
}
