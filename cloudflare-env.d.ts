// Minimal Cloudflare bindings interface.
// Regenerate from wrangler.toml with: `npm run cf-typegen`
interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  ASSETS: Fetcher;
  // Secrets (set in .dev.vars locally, `wrangler secret put` in prod):
  // --- AWS Cognito (authentication) ---
  COGNITO_REGION: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_CLIENT_SECRET: string;
  COGNITO_DOMAIN: string; // Hosted UI domain, e.g. wahala.auth.us-east-1.amazoncognito.com
  // --- Stripe / Anthropic ---
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ANTHROPIC_API_KEY: string;
}
