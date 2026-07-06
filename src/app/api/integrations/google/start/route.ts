/**
 * GET /api/integrations/google/start — begin the Google Calendar connect flow
 * (per-user OAuth, offline access). Same state/PKCE cookie dance as SSO login,
 * different scopes + callback. Staff only.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/auth/context";
import { startConnect } from "@/services/integrations/google-calendar";
import { LOGIN_PATH } from "@/auth/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.isStaff) return NextResponse.redirect(new URL(LOGIN_PATH, req.url));

  const reqUrl = new URL(req.url);
  const secure = reqUrl.protocol === "https:";
  const redirectUri = new URL("/api/integrations/google/callback", reqUrl.origin).toString();
  try {
    const { url, state, codeVerifier } = startConnect(redirectUri);
    const res = NextResponse.redirect(url);
    const opts = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/integrations/google", maxAge: 600 };
    res.cookies.set("gcal_state", state, opts);
    res.cookies.set("gcal_verifier", codeVerifier, opts);
    return res;
  } catch (err) {
    console.error("[gcal] start failed:", err);
    return NextResponse.redirect(new URL("/dashboard?gcal=error", req.url));
  }
}
