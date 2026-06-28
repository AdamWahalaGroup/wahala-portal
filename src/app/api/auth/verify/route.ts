/**
 * GET /api/auth/verify?token=...
 *
 * Consume a magic-link token, mint a session, set the cookie, and redirect into
 * the app. A token is single-use (deleted on consume). First successful login
 * flips an invited user to active.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { consumeMagicToken } from "@/auth/magic-link";
import { createSession, sessionCookieOptions } from "@/auth/session";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  POST_LOGIN_PATH,
  LOGIN_PATH,
} from "@/auth/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const secure = url.protocol === "https:";

  const fail = () =>
    NextResponse.redirect(new URL(`${LOGIN_PATH}?error=link_invalid`, req.url));

  if (!token) return fail();

  const payload = await consumeMagicToken(token);
  if (!payload) return fail();

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, payload.userId),
  });
  if (!user || user.status === "disabled") return fail();

  if (user.status === "invited") {
    await db
      .update(schema.users)
      .set({ status: "active" })
      .where(eq(schema.users.id, user.id));
  }

  const sessionId = await createSession(user.id);
  const res = NextResponse.redirect(new URL(POST_LOGIN_PATH, req.url));
  res.cookies.set(
    SESSION_COOKIE,
    sessionId,
    sessionCookieOptions(SESSION_TTL_SECONDS, secure),
  );
  return res;
}
