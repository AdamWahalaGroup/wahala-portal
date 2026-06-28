/**
 * Magic-link tokens — single-use, short-lived, KV-backed.
 *
 * The raw token travels in the email URL; KV stores only its hash → payload.
 * Consuming a token deletes it, so a link works exactly once.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { KV_MAGIC_PREFIX, MAGIC_LINK_TTL_SECONDS } from "@/auth/config";
import { randomToken, hashToken } from "@/auth/crypto";

export type MagicPayload = { userId: string; email: string };

/** Mint a single-use token for `user`; returns the raw token (caller builds the URL). */
export async function createMagicToken(user: MagicPayload): Promise<string> {
  const { env } = getCloudflareContext();
  const raw = randomToken();
  const key = KV_MAGIC_PREFIX + (await hashToken(raw));
  await env.SESSIONS.put(key, JSON.stringify(user), {
    expirationTtl: MAGIC_LINK_TTL_SECONDS,
  });
  return raw;
}

/** Verify + invalidate a token. Returns the payload once, or null if missing/expired. */
export async function consumeMagicToken(raw: string): Promise<MagicPayload | null> {
  const { env } = getCloudflareContext();
  const key = KV_MAGIC_PREFIX + (await hashToken(raw));
  const json = await env.SESSIONS.get(key);
  if (!json) return null;
  await env.SESSIONS.delete(key); // single-use
  try {
    return JSON.parse(json) as MagicPayload;
  } catch {
    return null;
  }
}
