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
  return vars().EMAIL_FROM ?? "login@wahala.group";
}
