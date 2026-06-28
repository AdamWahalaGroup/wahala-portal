/**
 * POST /api/auth/request  { email }
 *
 * Start the magic-link flow. Invite-only: we only mint a token for an existing,
 * non-disabled user. The response is the SAME whether or not the email maps to a
 * user (no account enumeration). In dev (DEV_AUTH=true) the link is returned in the
 * body so the loop is testable without an onboarded email domain.
 */
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createMagicToken } from "@/auth/magic-link";
import { sendMagicLinkEmail } from "@/auth/email";
import { isDevAuth } from "@/auth/server-env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const email = (await readEmail(req)).trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email." },
      { status: 400 },
    );
  }

  const generic = {
    ok: true,
    message: "If that email has an account, a sign-in link is on its way.",
  };

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  let devLink: string | undefined;
  if (user && user.status !== "disabled") {
    const token = await createMagicToken({ userId: user.id, email: user.email });
    const url = new URL(`/api/auth/verify?token=${token}`, req.url).toString();

    if (isDevAuth()) {
      devLink = url;
      console.log(`[auth] magic link for ${email}: ${url}`);
    } else {
      try {
        await sendMagicLinkEmail(user.email, url);
      } catch (err) {
        // Don't leak failure to the caller; log for ops.
        console.error("[auth] magic-link email send failed:", err);
      }
    }
  }

  return NextResponse.json(devLink ? { ...generic, devLink } : generic);
}

async function readEmail(req: NextRequest): Promise<string> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    return body?.email ?? "";
  }
  const form = await req.formData().catch(() => null);
  return form ? String(form.get("email") ?? "") : "";
}
