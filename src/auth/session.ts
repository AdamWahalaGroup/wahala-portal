/**
 * Server-side sessions — KV-backed, opaque cookie.
 *
 * The cookie holds a random session id; KV maps its hash → { userId }. TTL slides
 * forward on each use. Logout deletes the KV record.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import {
  KV_SESSION_PREFIX,
  SESSION_TTL_SECONDS,
  SESSION_COOKIE,
} from "@/auth/config";
import { randomToken, hashToken } from "@/auth/crypto";

type SessionRecord = { userId: string; createdAt: number };

/** Create a session in KV; returns the raw id to place in the cookie. */
export async function createSession(userId: string): Promise<string> {
  const { env } = getCloudflareContext();
  const raw = randomToken();
  const key = KV_SESSION_PREFIX + (await hashToken(raw));
  const record: SessionRecord = { userId, createdAt: Date.now() };
  await env.SESSIONS.put(key, JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return raw;
}

/** Resolve a raw session id → userId, sliding the TTL forward. Null if unknown/expired. */
export async function getSessionUserId(raw: string): Promise<string | null> {
  const { env } = getCloudflareContext();
  const key = KV_SESSION_PREFIX + (await hashToken(raw));
  const json = await env.SESSIONS.get(key);
  if (!json) return null;
  let record: SessionRecord;
  try {
    record = JSON.parse(json) as SessionRecord;
  } catch {
    return null;
  }
  await env.SESSIONS.put(key, json, { expirationTtl: SESSION_TTL_SECONDS }); // sliding expiry
  return record.userId;
}

/** Delete a session (logout). */
export async function destroySession(raw: string): Promise<void> {
  const { env } = getCloudflareContext();
  const key = KV_SESSION_PREFIX + (await hashToken(raw));
  await env.SESSIONS.delete(key);
}

/** Read the raw session id from the request cookie. */
export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Cookie attributes. `secure` is derived from the request protocol by the caller
 * (https in prod; http on localhost) so local testing over http still works.
 */
export function sessionCookieOptions(maxAge: number, secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const, // survives the top-level GET navigation from the email link
    path: "/",
    maxAge,
  };
}
