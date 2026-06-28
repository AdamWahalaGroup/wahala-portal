/**
 * POST /api/auth/logout — destroy the session and clear the cookie.
 */
import { NextResponse, type NextRequest } from "next/server";
import { readSessionCookie, destroySession, sessionCookieOptions } from "@/auth/session";
import { SESSION_COOKIE, LOGIN_PATH } from "@/auth/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await readSessionCookie();
  if (raw) await destroySession(raw);

  const secure = new URL(req.url).protocol === "https:";
  // 303 so the browser follows with a GET to the login page.
  const res = NextResponse.redirect(new URL(LOGIN_PATH, req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0, secure));
  return res;
}
