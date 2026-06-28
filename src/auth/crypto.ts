/**
 * Web Crypto helpers (workerd-native — no Node crypto).
 *
 * We mint high-entropy secrets and store only their SHA-256 hash in KV, so a
 * leaked KV dump never yields a usable magic-link token or session id.
 */

const encoder = new TextEncoder();

/** URL-safe random secret. 32 bytes → 43-char base64url. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

/** SHA-256 → hex. We key KV by this hash, never by the raw secret. */
export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
