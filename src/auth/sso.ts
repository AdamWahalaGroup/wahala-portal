/**
 * Social SSO (OIDC) — an additional front door to existing accounts.
 *
 * Pluggable by provider (Google now; Microsoft Entra is one registry entry away).
 * Built on `arctic` (Fetch-based, Workers-compatible) for the authorization-code +
 * PKCE flow; the OUTCOME is identical to the magic-link verify route — resolve a
 * userId, then mint the existing KV session.
 *
 * Policy (see resolveSsoOutcome): invite-only is preserved — SSO logs into an
 * existing, non-disabled account matched by the provider's VERIFIED email. Unknown
 * emails are denied (no auto-provisioning).
 */
import { Google, generateState, generateCodeVerifier, decodeIdToken } from "arctic";
import { googleClientId, googleClientSecret } from "@/auth/server-env";

export type SsoProvider = "google";

const SCOPES = ["openid", "email", "profile"];

export function isSsoProvider(p: string): p is SsoProvider {
  return p === "google";
}

/** Construct the provider client with a per-request redirect URI (derived from origin). */
function makeClient(provider: SsoProvider, redirectUri: string): Google {
  // provider is currently always "google"; add a switch when more providers land.
  void provider;
  return new Google(googleClientId(), googleClientSecret(), redirectUri);
}

/** Begin the flow: returns the provider authorization URL + the state/PKCE to stash. */
export function startAuthorization(provider: SsoProvider, redirectUri: string) {
  const client = makeClient(provider, redirectUri);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, codeVerifier, SCOPES);
  return { url, state, codeVerifier };
}

type IdTokenClaims = { email?: string; email_verified?: boolean; sub?: string; name?: string };

/** Exchange the code (server↔provider over TLS) and read the id_token claims. */
export async function completeAuthorization(
  provider: SsoProvider,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<{ email: string | null; emailVerified: boolean; sub: string | null; name: string | null }> {
  const client = makeClient(provider, redirectUri);
  const tokens = await client.validateAuthorizationCode(code, codeVerifier);
  const claims = decodeIdToken(tokens.idToken()) as IdTokenClaims;
  return {
    email: claims.email ? claims.email.toLowerCase() : null,
    emailVerified: claims.email_verified === true,
    sub: claims.sub ?? null,
    name: claims.name ?? null,
  };
}

/** The domain part of an email, lower-cased (""), if malformed. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

// ---- pure policy (unit-tested) ----

export type SsoUser = { id: string; status: "invited" | "active" | "disabled" } | null;

export type SsoOutcome =
  | { ok: true; kind: "login"; userId: string; activate: boolean }
  | { ok: true; kind: "provision_staff" } // wahalagroup.com etc. → auto-create a Wahala admin
  | { ok: false; reason: "unverified_email" | "no_account" | "disabled" };

/**
 * Decide what a verified SSO identity may do, matched by email:
 *  - existing account → log in (activate an invited one);
 *  - no account on a STAFF domain → auto-provision a Wahala admin;
 *  - no account otherwise → denied (clients are invite-only).
 */
export function resolveSsoOutcome(
  user: SsoUser,
  emailVerified: boolean,
  opts: { isStaffDomain: boolean },
): SsoOutcome {
  if (!emailVerified) return { ok: false, reason: "unverified_email" };
  if (user) {
    if (user.status === "disabled") return { ok: false, reason: "disabled" };
    return { ok: true, kind: "login", userId: user.id, activate: user.status === "invited" };
  }
  if (opts.isStaffDomain) return { ok: true, kind: "provision_staff" };
  return { ok: false, reason: "no_account" };
}
