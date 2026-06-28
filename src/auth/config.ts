/**
 * Auth configuration — magic-link login + KV-backed sessions.
 *
 * No passwords, no external IdP. Identity = email (see `users` table). This file
 * is PURE constants only (no server imports) so client components can import it.
 * Runtime/env-derived flags live in `./server-env`.
 */

// KV key namespaces (everything stored in env.SESSIONS).
export const KV_MAGIC_PREFIX = "magic:";
export const KV_SESSION_PREFIX = "session:";

// Lifetimes.
export const MAGIC_LINK_TTL_SECONDS = 15 * 60; // 15 min, single-use
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days, sliding

// Session cookie name.
export const SESSION_COOKIE = "wahala_session";

// Navigation targets.
export const POST_LOGIN_PATH = "/dashboard";
export const LOGIN_PATH = "/login";
