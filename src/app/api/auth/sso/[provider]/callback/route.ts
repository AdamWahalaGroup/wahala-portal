/**
 * GET /api/auth/sso/:provider/callback — finish a social-SSO login.
 *
 * Mirrors the magic-link verify route: validate the OAuth state + code, read the
 * provider's verified email, match an existing account (invite-only), then mint the
 * same KV session. No auto-provisioning — unknown emails are denied.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { completeAuthorization, resolveSsoOutcome, isSsoProvider } from "@/auth/sso";
import { createSession, sessionCookieOptions } from "@/auth/session";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, POST_LOGIN_PATH, LOGIN_PATH } from "@/auth/config";
import { securityLog } from "@/lib/security-log";

export const dynamic = "force-dynamic";

const DENY_ERROR: Record<string, string> = {
  no_account: "sso_no_account",
  disabled: "account_disabled",
  unverified_email: "sso_unverified",
};

function clearSsoCookies(res: NextResponse) {
  const opts = { path: "/api/auth/sso", maxAge: 0 };
  res.cookies.set("sso_state", "", opts);
  res.cookies.set("sso_verifier", "", opts);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const reqUrl = new URL(req.url);
  const secure = reqUrl.protocol === "https:";

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`${LOGIN_PATH}?error=${reason}`, req.url));
    clearSsoCookies(res);
    return res;
  };

  if (!isSsoProvider(provider)) return fail("sso_unknown_provider");

  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const cookieState = req.cookies.get("sso_state")?.value;
  const codeVerifier = req.cookies.get("sso_verifier")?.value;

  // CSRF / integrity: state must round-trip and match the stashed cookie.
  if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
    return fail("sso_failed");
  }

  const redirectUri = new URL(`/api/auth/sso/${provider}/callback`, reqUrl.origin).toString();

  try {
    const { email, emailVerified } = await completeAuthorization(provider, redirectUri, code, codeVerifier);
    if (!email) return fail("sso_failed");

    const db = getDb();
    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    const outcome = resolveSsoOutcome(user ? { id: user.id, status: user.status } : null, emailVerified);

    if (!outcome.ok) {
      securityLog({
        actorUserId: user?.id ?? null,
        action: `sso.${provider}`,
        resource: `email:${email}`,
        reason: outcome.reason,
      });
      return fail(DENY_ERROR[outcome.reason] ?? "sso_failed");
    }

    if (outcome.activate) {
      await db.update(schema.users).set({ status: "active" }).where(eq(schema.users.id, outcome.userId));
    }

    const sessionId = await createSession(outcome.userId);
    const res = NextResponse.redirect(new URL(POST_LOGIN_PATH, req.url));
    res.cookies.set(SESSION_COOKIE, sessionId, sessionCookieOptions(SESSION_TTL_SECONDS, secure));
    clearSsoCookies(res);
    return res;
  } catch (err) {
    console.error("[sso] callback failed:", err);
    return fail("sso_failed");
  }
}
