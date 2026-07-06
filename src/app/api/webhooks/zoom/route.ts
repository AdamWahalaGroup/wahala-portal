/**
 * POST /api/webhooks/zoom — Zoom event subscriptions (public endpoint, HMAC-gated):
 *   endpoint.url_validation      → signed plainToken echo (Zoom's endpoint check)
 *   recording.transcript_completed → download VTT → deal_calls (matched) or the
 *                                    unmatched inbox; extractor + readiness run
 *   meeting.ended                → status bookkeeping
 * "Posts, not real time" — the whole loop is webhook-driven, no polling.
 */
import { NextResponse } from "next/server";
import {
  verifyZoomSignature,
  hmacHex,
  handleTranscriptCompleted,
  webhookDownloader,
  markMeetingEnded,
  webhookSecret,
  type TranscriptCompletedPayload,
} from "@/services/integrations/zoom";

export const dynamic = "force-dynamic";

type ZoomEvent = {
  event?: string;
  payload?: TranscriptCompletedPayload & { plainToken?: string };
  download_token?: string;
};

export async function POST(req: Request) {
  const secret = await webhookSecret();
  const body = await req.text();

  const ok = await verifyZoomSignature(req.headers.get("x-zm-signature"), req.headers.get("x-zm-request-timestamp"), body, secret);
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let event: ZoomEvent;
  try {
    event = JSON.parse(body) as ZoomEvent;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (event.event === "endpoint.url_validation") {
    const plainToken = event.payload?.plainToken ?? "";
    return NextResponse.json({ plainToken, encryptedToken: await hmacHex(secret, plainToken) });
  }

  if (event.event === "recording.transcript_completed") {
    try {
      const result = await handleTranscriptCompleted(event.payload ?? {}, webhookDownloader(event.download_token));
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      console.error("[zoom] transcript handling failed:", err);
      // 200 anyway — Zoom retries on 4xx/5xx and the failure is on our side to fix.
      return NextResponse.json({ ok: false });
    }
  }

  if (event.event === "meeting.ended") {
    const id = event.payload?.object?.id;
    if (id !== undefined) await markMeetingEnded(String(id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
}
