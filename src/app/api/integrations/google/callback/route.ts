/**
 * GET /api/integrations/google/callback — finish the Calendar connect: verify
 * state, exchange the code (PKCE), store the refresh token, land on the dashboard.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/auth/context";
import { completeConnect } from "@/services/integrations/google-calendar";
import { LOGIN_PATH } from "@/auth/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.isStaff) return NextResponse.redirect(new URL(LOGIN_PATH, req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gcal_state")?.value;
  const verifier = req.cookies.get("gcal_verifier")?.value;

  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard?gcal=${q}`, req.url));
    res.cookies.delete("gcal_state");
    res.cookies.delete("gcal_verifier");
    return res;
  };

  if (!code || !state || !cookieState || !verifier || state !== cookieState) return back("error");
  try {
    const redirectUri = new URL("/api/integrations/google/callback", url.origin).toString();
    await completeConnect(ctx, redirectUri, code, verifier);
    return back("connected");
  } catch (err) {
    console.error("[gcal] callback failed:", err);
    return back("error");
  }
}
