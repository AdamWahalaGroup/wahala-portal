/**
 * GET /api/auth/sso/:provider — begin a social-SSO login.
 *
 * Generates state (CSRF) + PKCE verifier, stashes them in short-lived httpOnly
 * cookies, and redirects to the provider's authorization page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { startAuthorization, isSsoProvider } from "@/auth/sso";
import { LOGIN_PATH } from "@/auth/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isSsoProvider(provider)) {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=sso_unknown_provider`, req.url));
  }

  const reqUrl = new URL(req.url);
  const secure = reqUrl.protocol === "https:";
  const redirectUri = new URL(`/api/auth/sso/${provider}/callback`, reqUrl.origin).toString();

  try {
    const { url, state, codeVerifier } = startAuthorization(provider, redirectUri);
    const res = NextResponse.redirect(url);
    const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth/sso", maxAge: 600 };
    res.cookies.set("sso_state", state, opts);
    res.cookies.set("sso_verifier", codeVerifier, opts);
    return res;
  } catch (err) {
    console.error("[sso] start failed:", err);
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=sso_unavailable`, req.url));
  }
}
