/**
 * Server-only, env-derived auth flags. Kept out of `./config` so that file stays
 * client-importable. These read the Cloudflare request env, so call them only
 * inside a request (route handler / server component / server action).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

function vars(): Record<string, string | undefined> {
  return getCloudflareContext().env as unknown as Record<string, string | undefined>;
}

/**
 * Dev mode: surface the magic link directly in the request response instead of
 * (only) emailing it. Set `DEV_AUTH=true` in `.dev.vars`. NEVER set in production
 * — it would hand a login link to anyone who knows a user's email.
 */
export function isDevAuth(): boolean {
  return vars().DEV_AUTH === "true";
}

/** From-address for login emails. Must be on a domain onboarded to Email Sending. */
export function emailFrom(): string {
  return vars().EMAIL_FROM ?? "login@wahala-services.com";
}

/**
 * Quote total (in cents) above which a Wahala admin must co-sign (PLAN.md §4, §12).
 * Placeholder default of $5,000 pending the figure you + Jason set. Configure via
 * the ADMIN_APPROVAL_THRESHOLD_CENTS var.
 */
export function adminApprovalThresholdCents(): number {
  const n = Number(vars().ADMIN_APPROVAL_THRESHOLD_CENTS);
  return Number.isFinite(n) && n > 0 ? n : 1_000_000; // $10,000 (design frame 06)
}

/** Google OAuth client id (var ok — not secret) for SSO. */
export function googleClientId(): string {
  return vars().GOOGLE_CLIENT_ID ?? "";
}

/** Google OAuth client secret (set via `wrangler secret put`). */
export function googleClientSecret(): string {
  return vars().GOOGLE_CLIENT_SECRET ?? "";
}

/**
 * AI draft provider — which LLM backend powers "Draft a project with AI". Kept as a
 * var so switching providers (e.g. openai → anthropic) is config, not a code change.
 * The provider-specific call lives behind AiDraftProvider in src/services/ai.
 */
export function aiProvider(): string {
  return (vars().AI_PROVIDER ?? "openai").trim().toLowerCase();
}

/** Lightweight model used for the single project-draft pass (vision + structured output). */
export function aiDraftModel(): string {
  return vars().AI_DRAFT_MODEL?.trim() || "gpt-4o-mini";
}

/** Model with built-in web search, used for lead recon. Empty string disables web lookup. */
export function aiSearchModel(): string {
  return vars().AI_SEARCH_MODEL?.trim() || "gpt-4o-mini-search-preview";
}

/** OpenAI API key (set via `wrangler secret put OPENAI_API_KEY`). Empty if unconfigured. */
export function openaiApiKey(): string {
  return vars().OPENAI_API_KEY ?? "";
}

/**
 * Email domains whose Google SSO logins are auto-provisioned as Wahala staff
 * admins (the internal team). Everyone else is invite-only. Comma-separated;
 * defaults to wahalagroup.com.
 */
export function staffSsoDomains(): string[] {
  const raw = vars().STAFF_SSO_DOMAINS ?? "wahalagroup.com";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
