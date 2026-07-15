/** Admin-managed Wahala staff invitations. */
import { NextResponse } from "next/server";
import { requireAuth, handleApiError, readJson } from "@/lib/api";
import { inviteTeamMember } from "@/services/team-members";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await readJson<{
      name?: string;
      email?: string;
      role?: string;
      trainingMode?: boolean;
    }>(req);
    const result = await inviteTeamMember(ctx, body, new URL(req.url).origin);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
