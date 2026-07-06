/**
 * GET /api/meetings/[id]/ics — "Add to calendar" (frame 46): a plain .ics
 * download that works with Outlook/Apple/Google — never a Google-only link, no
 * account needed. Staff, or a client user of the meeting's org.
 */
import { requireAuth, handleApiError } from "@/lib/api";
import { icsForMeeting } from "@/services/meetings";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const { fileName, ics } = await icsForMeeting(ctx, id);
    return new Response(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
